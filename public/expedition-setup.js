import { escapeHtml } from './expedition-board.js';

export function createSetup({ request, action, fail }) {
    const $ = id => document.getElementById(id);
    let last = '', settingsLoaded = false, lastGiftSetting, canControl = false;
    $('overlay-url').value = `${location.origin}/overlay`;
    $('callback-url').value = `${location.origin}/auth/twitch/callback`;
    $('viewer-message').value = 'Get your explorer: !join → climb: !dig → at the stop, !keep saves your loot or !risk tries for more. A fall can lose this climb’s loot. Earlier items and XP stay yours.';
    try { $('obs-added').checked = localStorage.getItem('excavation-obs-added:' + location.origin) === 'yes'; } catch { /* Optional checklist. */ }
    $('obs-added').onchange = () => { try { localStorage.setItem('excavation-obs-added:' + location.origin, $('obs-added').checked ? 'yes' : 'no'); } catch { /* Optional checklist. */ } };
    function copy(button, input) {
        $(button).onclick = async () => {
            try { await navigator.clipboard.writeText($(input).value); $(button).textContent = 'Copied!'; }
            catch { $(input).focus(); $(input).select(); $(button).textContent = 'Selected — copy with your keyboard'; }
        };
    }
    copy('copy-overlay', 'overlay-url');
    copy('copy-viewer-message', 'viewer-message');
    $('channels').onclick = async event => {
        const b = event.target.closest('button[data-channel]');
        if (!b || !canControl || b.disabled) return;
        b.disabled = true;
        try {
            const data = await request(`/api/twitch/${b.dataset.connected === 'true' ? 'disconnect' : 'connect'}`, { team: b.dataset.channel });
            if (data.url) location.href = data.url;
        } catch (e) { fail(e); }
        finally { last = ''; }
    };
    $('start-live').onclick = () => action('live').then(() => location.hash = 'camp').catch(fail);
    $('return-demo').onclick = () => action('demo').then(() => location.hash = 'home').catch(fail);
    $('settings-form').onsubmit = async event => {
        event.preventDefault();
        try {
            await action('settings', { settings: { slots: Number($('slots').value), cooldownSeconds: Number($('cooldown').value), side: $('side').value, avatarSize: Number($('avatar-size').value), autoDigOnJoin: $('auto-dig').checked, giftRocks: $('gift-rocks').checked } });
            $('settings-feedback').textContent = 'Saved. Both overlays update together.';
        } catch (e) { fail(e); }
    };
    return (data, canAct) => {
        const { state, capabilities } = data;
        canControl = canAct;
        const connected = Object.values(state.channels).some(c => c.status === 'connected');
        const live = state.mode === 'live';
        const key = JSON.stringify([state.channels, capabilities.twitch, canAct]);
        if (last !== key) {
            last = key;
            const channel = team => {
                const c = state.channels[team], on = c.status !== 'offline';
                return `<div class="channel"><div><strong>${escapeHtml(c.name || (team === 'a' ? 'Your channel' : 'Partner channel'))}</strong><p>${escapeHtml(c.note)}</p>${c.status === 'connected' ? `<small>Hype Train: ${c.hypeAvailable ? 'connected' : 'unavailable'} · Gift subs: ${c.giftsAvailable ? 'connected' : 'unavailable'}</small>` : ''}</div><button data-channel="${team}" data-connected="${on}" ${!canAct || (!on && !capabilities.twitch) ? 'disabled' : ''}>${on ? 'Disconnect' : 'Connect Twitch'}</button></div>`;
            };
            const partnerOpen = $('channels').querySelector('details')?.open;
            $('channels').innerHTML = channel('a') + `<details class="partner-setup" ${partnerOpen || state.channels.b.status !== 'offline' ? 'open' : ''}><summary>Add a partner stream <small>OPTIONAL</small></summary><p>Share one server and send each other rescue ropes. Both streams see both camps.</p>${channel('b')}</details>`;
            $('twitch-help').textContent = capabilities.twitch ? 'Sign in as the broadcaster of each channel.' : 'Twitch isn’t configured on this server yet. Open the one-time setup below.';
        }
        $('setup-next').textContent = !canAct ? 'Connect to the server and unlock stream controls first.' : !connected ? 'Next: connect your Twitch channel.' : !$('obs-added').checked ? 'Next: add the OBS source below.' : !live ? 'Next: open the camp, then paste the chat instructions.' : state.players.length ? 'Your camp is live. Viewers can join and climb.' : 'Next: ask a viewer to type !join in Twitch chat.';
        $('start-live').disabled = !canAct || !connected || live;
        $('start-live').textContent = live ? 'Camp is open for Twitch chat' : 'Open camp for Twitch chat';
        $('live-status').textContent = live ? 'Test viewers are off. Real chat commands now control explorers.' : connected ? 'This ends demo climbs and opens a separate camp for real viewers.' : 'Connect a channel in step 1 to enable this.';
        $('viewer-check').textContent = live ? state.players.length ? `${state.players.length} Twitch ${state.players.length === 1 ? 'viewer has' : 'viewers have'} joined.` : 'Waiting for the first !join from Twitch.' : 'The first real viewer will appear here after you open the camp.';
        $('obs-note').textContent = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? 'This URL works on this computer. A partner on another computer needs a shared HTTPS server.' : 'Both streamers use this same URL. It contains no login or control token.';
        $('return-demo').hidden = !live;
        $('return-demo').disabled = !canAct;
        $('settings-form').querySelector('button[type=submit]').disabled = !canAct;
        if (!settingsLoaded) {
            settingsLoaded = true;
            $('slots').value = state.settings.slots;
            $('cooldown').value = state.settings.cooldownSeconds;
            $('side').value = state.settings.side;
            $('avatar-size').value = state.settings.avatarSize;
            $('auto-dig').checked = state.settings.autoDigOnJoin;
        }
        if (lastGiftSetting !== state.settings.giftRocks) {
            lastGiftSetting = state.settings.giftRocks;
            $('gift-rocks').checked = lastGiftSetting;
        }
    };
}
