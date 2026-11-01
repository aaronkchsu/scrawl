import { randomBytes } from 'node:crypto';
import type { HypeEvent } from './expedition.ts';
import type { GiftEvent } from './expedition-events.ts';
import type { ChatMessage, Team, TeamId } from './types.ts';
export type Credentials = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expiresAt: number;
    id: string;
    login: string;
};
type Connection = {
    credentials: Credentials;
    socket: WebSocket | null;
    timer: ReturnType<typeof setTimeout> | null;
    refreshTimer: ReturnType<typeof setTimeout> | null;
    watchdog: ReturnType<typeof setTimeout> | null;
    validationTimer?: ReturnType<typeof setTimeout>;
    stopped: boolean;
    connected?: boolean;
    retries: number;
    hypeAvailable: boolean;
    giftsAvailable: boolean;
};
export class TwitchConnections {
    readonly configured: boolean;
    private clientId: string;
    private clientSecret: string;
    private baseUrl: string;
    private pending = new Map<string, {
        team: TeamId;
        expires: number;
        session: string;
    }>();
    private connections = new Map<TeamId, Connection>();
    private onMessage: (message: Omit<ChatMessage, 'at'>) => void;
    private onStatus: (id: TeamId, channel: string | null, status: Team['connection'], note: string) => void;
    private onHype?: (event: HypeEvent) => void;
    private onHypeStatus?: (team: TeamId, available: boolean) => void;
    private onGift?: (event: GiftEvent) => void;
    private onGiftStatus?: (team: TeamId, available: boolean) => void;
    private seen = new Set<string>();
    private onCredentials?: (credentials: Credentials) => Promise<void>;
    private onRevoked?: (id: string) => Promise<void>;
    constructor(options: {
        onCredentials?: TwitchConnections['onCredentials'];
        onRevoked?: TwitchConnections['onRevoked'];
        onHype?: TwitchConnections['onHype'];
        onHypeStatus?: TwitchConnections['onHypeStatus'];
        onGift?: TwitchConnections['onGift'];
        onGiftStatus?: TwitchConnections['onGiftStatus'];
        baseUrl: string;
        onMessage: TwitchConnections['onMessage'];
        onStatus: TwitchConnections['onStatus'];
    }, env = process.env) {
        this.clientId = env.TWITCH_CLIENT_ID ?? '';
        this.onCredentials = options.onCredentials; this.onRevoked = options.onRevoked;
        this.clientSecret = env.TWITCH_CLIENT_SECRET ?? '';
        this.configured = Boolean(this.clientId && this.clientSecret);
        this.onHype = options.onHype;
        this.onHypeStatus = options.onHypeStatus;
        this.onGift = options.onGift;
        this.onGiftStatus = options.onGiftStatus;
        this.baseUrl = options.baseUrl;
        this.onMessage = options.onMessage;
        this.onStatus = options.onStatus;
    }
    async connectCredentials(credentials: Credentials) {
        this.disconnect('a');
        const connection: Connection = { credentials: { ...credentials }, socket: null, timer: null, refreshTimer: null, watchdog: null, stopped: false, retries: 0, hypeAvailable: false, giftsAvailable: false };
        this.connections.set('a', connection);
        if (credentials.expiresAt <= Date.now() + 120000) { await this.refresh('a', connection); return; }
        if (await this.validate('a', connection)) { this.open('a', connection); this.scheduleRefresh('a', connection); }
    }
    private async validate(team: TeamId, connection: Connection): Promise<boolean> {
        if (connection.stopped) return false;
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', { signal: AbortSignal.timeout(10000), headers: { Authorization: `OAuth ${connection.credentials.access_token}` } });
            if (connection.stopped) return false;
            if (response.status === 401) {
                this.disconnect(team); await this.onRevoked?.(connection.credentials.id);
                this.onStatus(team, connection.credentials.login, 'error', 'Twitch access expired. Sign in again.'); return false;
            }
            if (!response.ok) throw new Error('Validation unavailable');
            const result = await response.json() as any;
            if (connection.stopped) return false;
            if (result.user_id !== connection.credentials.id || result.client_id !== this.clientId || !result.scopes?.includes('user:read:chat')) {
                this.disconnect(team); await this.onRevoked?.(connection.credentials.id); return false;
            }
            if (connection.validationTimer) clearTimeout(connection.validationTimer);
            connection.validationTimer = setTimeout(() => void this.validate(team, connection), 3600000); connection.validationTimer.unref();
            if (connection.connected) this.onStatus(team, connection.credentials.login, 'connected', 'Chat connected.');
            return !connection.stopped;
        } catch {
            if (!connection.stopped) {
                this.onStatus(team, connection.credentials.login, 'connecting', 'Checking Twitch access. Retrying shortly.');
                connection.validationTimer = setTimeout(async () => { if (await this.validate(team, connection)) { if (!connection.socket) this.open(team, connection); this.scheduleRefresh(team, connection); } }, 30000); connection.validationTimer.unref();
            }
            return false;
        }
    }
    authorize(team: TeamId, session: string) {
        if (!this.configured)
            throw new Error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET, then restart.');
        const state = randomBytes(24).toString('hex');
        for (const [key, pending] of this.pending)
            if (pending.expires < Date.now())
                this.pending.delete(key);
        this.pending.set(state, { team, session, expires: Date.now() + 600000 });
        const url = new URL('https://id.twitch.tv/oauth2/authorize');
        url.search = new URLSearchParams({ client_id: this.clientId, redirect_uri: `${this.baseUrl}/auth/twitch/callback`, response_type: 'code', scope: 'user:read:chat channel:read:hype_train channel:read:subscriptions', state, force_verify: 'true' }).toString();
        return url.href;
    }
    async complete(code: string, state: string, session: string) {
        const pending = this.pending.get(state);
        this.pending.delete(state);
        if (!pending || pending.expires < Date.now() || pending.session !== session)
            throw new Error('Twitch sign-in expired or was opened in a different browser session. Try connecting again.');
        const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, code, grant_type: 'authorization_code', redirect_uri: `${this.baseUrl}/auth/twitch/callback` }) });
        if (!response.ok)
            throw new Error('Twitch sign-in could not be completed. Check the registered redirect URL.');
        const tokens = await response.json() as Credentials;
        const userResponse = await fetch('https://api.twitch.tv/helix/users', { signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${tokens.access_token}`, 'Client-Id': this.clientId } });
        if (!userResponse.ok)
            throw new Error('Twitch could not identify the connected account.');
        const user = (await userResponse.json() as any).data?.[0];
        if (!user?.id)
            throw new Error('No Twitch account returned.');
        for (const [id, connection] of this.connections)
            if (id !== pending.team && connection.credentials.id === user.id)
                throw new Error('Connect a different account for the second channel.');
        this.disconnect(pending.team);
        const connection: Connection = { credentials: { ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000, id: user.id, login: user.login }, socket: null, timer: null, refreshTimer: null, watchdog: null, stopped: false, retries: 0, hypeAvailable: false, giftsAvailable: false };
        this.connections.set(pending.team, connection);
        this.open(pending.team, connection);
        this.scheduleRefresh(pending.team, connection);
        return pending.team;
    }
    private scheduleRefresh(team: TeamId, connection: Connection) {
        if (connection.refreshTimer)
            clearTimeout(connection.refreshTimer);
        connection.refreshTimer = setTimeout(() => void this.refresh(team, connection), Math.max(1000, connection.credentials.expiresAt - Date.now() - 120000));
        connection.refreshTimer.unref();
    }
    private async refresh(team: TeamId, connection: Connection) {
        if (connection.stopped)
            return;
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'refresh_token', refresh_token: connection.credentials.refresh_token }) });
            if (connection.stopped) return;
            if ([400, 401].includes(response.status)) {
                this.disconnect(team); await this.onRevoked?.(connection.credentials.id);
                this.onStatus(team, connection.credentials.login, 'error', 'Twitch access expired. Sign in again.'); return;
            }
            if (!response.ok) throw new Error('Twitch is unavailable.');
            const tokens = await response.json() as Credentials;
            if (connection.stopped)
                return;
            Object.assign(connection.credentials, tokens, { expiresAt: Date.now() + tokens.expires_in * 1000 });
            await this.onCredentials?.(connection.credentials);
            if (connection.stopped) return;
            if (!connection.socket && await this.validate(team, connection)) this.open(team, connection);
            if (connection.connected) this.onStatus(team, connection.credentials.login, 'connected', 'Chat connected.');
            this.scheduleRefresh(team, connection);
        }
        catch {
            if (!connection.stopped) {
                this.onStatus(team, connection.credentials.login, 'connecting', 'Twitch refresh failed. Retrying shortly.');
                connection.refreshTimer = setTimeout(() => void this.refresh(team, connection), 30000); connection.refreshTimer.unref();
            }
        }
    }
    private open(team: TeamId, connection: Connection, reconnectUrl?: string) {
        if (connection.stopped)
            return;
        // Never follow a reconnect URL outside Twitch's EventSub service.
        const url = reconnectUrl ? new URL(reconnectUrl) : new URL('wss://eventsub.wss.twitch.tv/ws');
        if (url.protocol !== 'wss:' || url.hostname !== 'eventsub.wss.twitch.tv')
            return;
        const previous = connection.socket;
        const socket = new WebSocket(url);
        connection.socket = socket;
        connection.connected = false;
        this.onStatus(team, connection.credentials.login, 'connecting', 'Connecting to Twitch chat…');
        const watch = (seconds = 30) => {
            if (connection.watchdog)
                clearTimeout(connection.watchdog);
            connection.watchdog = setTimeout(() => socket.close(), (seconds + 10) * 1000);
            connection.watchdog.unref();
        };
        watch();
        socket.addEventListener('message', async (event) => {
            if (connection.stopped || connection.socket !== socket)
                return;
            try {
                const data = JSON.parse(String(event.data));
                watch(data.payload?.session?.keepalive_timeout_seconds ?? 30);
                const type = data.metadata?.message_type;
                if (type === 'session_welcome') {
                    if (previous && previous !== socket)
                        previous.close();
                    if (!reconnectUrl) {
                        const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                            method: 'POST', signal: AbortSignal.timeout(8000),
                            headers: { Authorization: `Bearer ${connection.credentials.access_token}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: connection.credentials.id, user_id: connection.credentials.id }, transport: { method: 'websocket', session_id: data.payload.session.id } }),
                        });
                        if (connection.stopped || connection.socket !== socket)
                            return;
                        if (!response.ok) {
                            if (response.status === 401) {
                                connection.socket = null; socket.close(); await this.refresh(team, connection);
                            } else if (response.status === 429 || response.status >= 500) {
                                socket.close(); // A fresh welcome recreates subscriptions after backoff.
                            } else {
                                this.disconnect(team);
                                this.onStatus(team, connection.credentials.login, 'error', 'Twitch chat permission is unavailable. Sign in again.');
                            }
                            return;
                        }
                    }
                    connection.retries = 0;
                    connection.connected = true;
                    this.onStatus(team, connection.credentials.login, 'connected', 'Chat connected. Start live mode to let viewers join.');
                    if (!reconnectUrl) {
                        const subscriptions = ['begin', 'progress', 'end'].map(kind => ({ type: `channel.hype_train.${kind}`, version: '2' }));
                        subscriptions.push({ type: 'channel.subscription.gift', version: '1' });
                        const responses = await Promise.all(subscriptions.map(subscription => fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                            method: 'POST', signal: AbortSignal.timeout(8000),
                            headers: { Authorization: `Bearer ${connection.credentials.access_token}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...subscription, condition: { broadcaster_user_id: connection.credentials.id }, transport: { method: 'websocket', session_id: data.payload.session.id } }),
                        }).catch(() => null)));
                        if (connection.stopped || connection.socket !== socket)
                            return;
                        connection.hypeAvailable = responses.slice(0, 3).every(response => response?.ok);
                        connection.giftsAvailable = Boolean(responses[3]?.ok);
                    }
                    // Twitch transfers subscriptions on session_reconnect; restore their
                    // availability after the transient "connecting" state cleared the UI.
                    this.onHypeStatus?.(team, connection.hypeAvailable);
                    this.onGiftStatus?.(team, connection.giftsAvailable);
                }
                else if (type === 'session_reconnect')
                    this.open(team, connection, data.payload.session.reconnect_url);
                else if (type === 'revocation' && data.payload?.subscription?.type?.startsWith('channel.hype_train.')) {
                    connection.hypeAvailable = false;
                    this.onHypeStatus?.(team, false);
                }
                else if (type === 'revocation' && data.payload?.subscription?.type === 'channel.subscription.gift') {
                    connection.giftsAvailable = false;
                    this.onGiftStatus?.(team, false);
                }
                else if (type === 'revocation') {
                    this.onStatus(team, connection.credentials.login, 'error', 'Twitch authorization was revoked. Reconnect this channel.');
                    this.disconnect(team);
                    await this.onRevoked?.(connection.credentials.id);
                }
                else if (type === 'notification' && (data.payload?.subscription?.type?.startsWith('channel.hype_train.') || data.payload?.subscription?.type === 'channel.subscription.gift')) {
                    if (this.seen.has(data.metadata.message_id))
                        return;
                    this.seen.add(data.metadata.message_id);
                    if (this.seen.size > 5000)
                        this.seen.delete(this.seen.values().next().value!);
                    const event = data.payload.event;
                    if (event.broadcaster_user_id && event.broadcaster_user_id !== connection.credentials.id) return;
                    if (data.payload.subscription.type === 'channel.subscription.gift')
                        this.onGift?.({ id: data.metadata.message_id, team, name: event.is_anonymous ? 'Anonymous gifter' : event.user_name || 'A viewer', total: event.total, at: Date.parse(data.metadata.message_timestamp) });
                    else
                        this.onHype?.({ deliveryId: data.metadata.message_id, id: event.id, team, kind: data.payload.subscription.type.split('.').pop(), level: event.level, expiresAt: Date.parse(event.expires_at ?? event.ended_at), startedAt: Date.parse(event.started_at) });
                }
                else if (type === 'notification' && data.metadata.subscription_type === 'channel.chat.message') {
                    const message = data.payload.event;
                    // Shared Chat can forward messages from other broadcasters. Each team reads only its origin.
                    if (message.source_broadcaster_user_id && message.source_broadcaster_user_id !== connection.credentials.id)
                        return;
                    this.onMessage({ id: `${connection.credentials.id}:${message.message_id}`, team, userId: message.chatter_user_id, name: message.chatter_user_name, text: message.message.text, source: 'twitch' });
                }
            }
            catch {
                if (!connection.stopped && connection.socket === socket)
                    socket.close();
            }
        });
        socket.addEventListener('close', () => {
            if (connection.socket !== socket)
                return;
            if (connection.watchdog)
                clearTimeout(connection.watchdog);
            if (connection.stopped)
                return;
            connection.socket = null;
            connection.connected = false;
            if (connection.timer) clearTimeout(connection.timer);
            this.onStatus(team, connection.credentials.login, 'connecting', 'Chat disconnected; reconnecting. Messages during the gap are not replayed by Twitch.');
            connection.timer = setTimeout(() => this.open(team, connection), Math.min(30000, 1000 * 2 ** connection.retries++));
            connection.timer.unref();
        });
        socket.addEventListener('error', () => socket.close());
    }
    disconnect(team: TeamId) {
        const connection = this.connections.get(team);
        if (connection) {
            connection.stopped = true;
            for (const timer of [connection.timer, connection.refreshTimer, connection.watchdog, connection.validationTimer])
                if (timer)
                    clearTimeout(timer);
            connection.socket?.close();
            this.connections.delete(team);
        }
        this.onStatus(team, null, 'offline', 'Channel disconnected.');
    }
    close() { for (const team of this.connections.keys())
        this.disconnect(team); }
}
