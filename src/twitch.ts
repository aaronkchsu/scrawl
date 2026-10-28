import { randomBytes } from 'node:crypto';
import type { ChatMessage, Team, TeamId } from './types.ts';

type Credentials = { access_token: string; refresh_token: string; expires_in: number; expiresAt: number; id: string; login: string };
type Connection = { credentials: Credentials; socket: WebSocket | null; timer: ReturnType<typeof setTimeout> | null; refreshTimer: ReturnType<typeof setTimeout> | null; watchdog: ReturnType<typeof setTimeout> | null; stopped: boolean; retries: number };
export class TwitchConnections {
  readonly configured: boolean;
  private clientId: string; private clientSecret: string; private baseUrl: string;
  private pending = new Map<string, { team: TeamId; expires: number; session: string }>();
  private connections = new Map<TeamId, Connection>();
  private onMessage: (message: Omit<ChatMessage, 'at'>) => void;
  private onStatus: (id: TeamId, channel: string | null, status: Team['connection'], note: string) => void;
  constructor(options: { baseUrl: string; onMessage: TwitchConnections['onMessage']; onStatus: TwitchConnections['onStatus'] }, env = process.env) {
    this.clientId = env.TWITCH_CLIENT_ID ?? ''; this.clientSecret = env.TWITCH_CLIENT_SECRET ?? ''; this.configured = Boolean(this.clientId && this.clientSecret);
    this.baseUrl = options.baseUrl; this.onMessage = options.onMessage; this.onStatus = options.onStatus;
  }
  authorize(team: TeamId, session: string) {
    if (!this.configured) throw new Error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET, then restart.');
    const state = randomBytes(24).toString('hex');
    for (const [key, pending] of this.pending) if (pending.expires < Date.now()) this.pending.delete(key);
    this.pending.set(state, { team, session, expires: Date.now() + 600_000 });
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.search = new URLSearchParams({ client_id: this.clientId, redirect_uri: `${this.baseUrl}/auth/twitch/callback`, response_type: 'code', scope: 'user:read:chat', state, force_verify: 'true' }).toString();
    return url.href;
  }
  async complete(code: string, state: string, session: string) {
    const pending = this.pending.get(state); this.pending.delete(state);
    if (!pending || pending.expires < Date.now() || pending.session !== session) throw new Error('Twitch sign-in expired or was opened in a different browser session. Try connecting again.');
    const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10_000), body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, code, grant_type: 'authorization_code', redirect_uri: `${this.baseUrl}/auth/twitch/callback` }) });
    if (!response.ok) throw new Error('Twitch sign-in could not be completed. Check the registered redirect URL.');
    const tokens = await response.json() as Credentials;
    const userResponse = await fetch('https://api.twitch.tv/helix/users', { signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${tokens.access_token}`, 'Client-Id': this.clientId } });
    if (!userResponse.ok) throw new Error('Twitch could not identify the connected account.');
    const user = (await userResponse.json() as any).data?.[0];
    if (!user?.id) throw new Error('No Twitch account returned.');
    for (const [id, connection] of this.connections) if (id !== pending.team && connection.credentials.id === user.id) throw new Error('Connect a different channel for the other team.');
    this.disconnect(pending.team);
    const connection: Connection = { credentials: { ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000, id: user.id, login: user.login }, socket: null, timer: null, refreshTimer: null, watchdog: null, stopped: false, retries: 0 };
    this.connections.set(pending.team, connection);
    this.open(pending.team, connection); this.scheduleRefresh(pending.team, connection);
    return pending.team;
  }
  private scheduleRefresh(team: TeamId, connection: Connection) {
    if (connection.refreshTimer) clearTimeout(connection.refreshTimer);
    connection.refreshTimer = setTimeout(() => void this.refresh(team, connection), Math.max(1000, connection.credentials.expiresAt - Date.now() - 120_000));
    connection.refreshTimer.unref();
  }
  private async refresh(team: TeamId, connection: Connection) {
    if (connection.stopped) return;
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10_000), body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'refresh_token', refresh_token: connection.credentials.refresh_token }) });
      if (!response.ok) throw new Error('Reconnect Twitch to renew authorization.');
      const tokens = await response.json() as Credentials;
      if (connection.stopped) return;
      Object.assign(connection.credentials, tokens, { expiresAt: Date.now() + tokens.expires_in * 1000 }); this.scheduleRefresh(team, connection);
    } catch { this.onStatus(team, connection.credentials.login, 'error', 'Authorization could not be renewed. Disconnect and reconnect Twitch.'); }
  }
  private open(team: TeamId, connection: Connection, reconnectUrl?: string) {
    if (connection.stopped) return;
    // Never follow a reconnect URL outside Twitch's EventSub service.
    const url = reconnectUrl ? new URL(reconnectUrl) : new URL('wss://eventsub.wss.twitch.tv/ws');
    if (url.protocol !== 'wss:' || url.hostname !== 'eventsub.wss.twitch.tv') return;
    const previous = connection.socket;
    const socket = new WebSocket(url); connection.socket = socket;
    this.onStatus(team, connection.credentials.login, 'connecting', 'Connecting to Twitch chat…');
    const watch = (seconds = 30) => {
      if (connection.watchdog) clearTimeout(connection.watchdog);
      connection.watchdog = setTimeout(() => socket.close(), (seconds + 10) * 1000); connection.watchdog.unref();
    };
    watch();
    socket.addEventListener('message', async event => {
      if (connection.stopped || connection.socket !== socket) return;
      try {
        const data = JSON.parse(String(event.data)); watch(data.payload?.session?.keepalive_timeout_seconds ?? 30);
        const type = data.metadata?.message_type;
        if (type === 'session_welcome') {
          if (previous && previous !== socket) previous.close();
          if (!reconnectUrl) {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
              method: 'POST', signal: AbortSignal.timeout(8000),
              headers: { Authorization: `Bearer ${connection.credentials.access_token}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: connection.credentials.id, user_id: connection.credentials.id }, transport: { method: 'websocket', session_id: data.payload.session.id } }),
            });
            if (!response.ok) { this.onStatus(team, connection.credentials.login, 'error', `Twitch chat subscription failed (${response.status}). Reconnect the channel.`); connection.stopped = true; socket.close(); return; }
          }
          connection.retries = 0; this.onStatus(team, connection.credentials.login, 'connected', 'Live chat connected. Suggestions are read only during an encounter.');
        } else if (type === 'session_reconnect') this.open(team, connection, data.payload.session.reconnect_url);
        else if (type === 'revocation') { this.onStatus(team, connection.credentials.login, 'error', 'Twitch authorization was revoked. Reconnect this channel.'); connection.stopped = true; socket.close(); }
        else if (type === 'notification' && data.metadata.subscription_type === 'channel.chat.message') {
          const message = data.payload.event;
          // Shared Chat can forward messages from other broadcasters. Each team reads only its origin.
          if (message.source_broadcaster_user_id && message.source_broadcaster_user_id !== connection.credentials.id) return;
          this.onMessage({ id: `${connection.credentials.id}:${message.message_id}`, team, userId: message.chatter_user_id, name: message.chatter_user_name, text: message.message.text, source: 'twitch' });
        }
      } catch { this.onStatus(team, connection.credentials.login, 'error', 'A Twitch connection event failed. Reconnect if chat stops updating.'); }
    });
    socket.addEventListener('close', () => {
      if (connection.socket !== socket) return;
      if (connection.watchdog) clearTimeout(connection.watchdog);
      if (connection.stopped) return;
      this.onStatus(team, connection.credentials.login, 'connecting', 'Chat disconnected; reconnecting. Messages during the gap are not replayed by Twitch.');
      connection.timer = setTimeout(() => this.open(team, connection), Math.min(30_000, 1000 * 2 ** connection.retries++)); connection.timer.unref();
    });
    socket.addEventListener('error', () => socket.close());
  }
  disconnect(team: TeamId) {
    const connection = this.connections.get(team);
    if (connection) { connection.stopped = true; for (const timer of [connection.timer, connection.refreshTimer, connection.watchdog]) if (timer) clearTimeout(timer); connection.socket?.close(); this.connections.delete(team); }
    this.onStatus(team, null, 'offline', 'Channel disconnected.');
  }
  close() { for (const team of this.connections.keys()) this.disconnect(team); }
}
