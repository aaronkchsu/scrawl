import { escapeHtml as esc } from './expedition-board.js';

export function createHostedSetup({ request, action, fail }) {
    const $ = id => document.getElementById(id);
    let latest, last = '', settingsKey = '', invitation = null, inviteError = '', allowed = false;
    let invite = new URLSearchParams(location.search).get('invite');
    try { if (invite) sessionStorage.setItem('camp-invite', invite); else invite = sessionStorage.getItem('camp-invite'); } catch {}
    if (invite) fetch('/api/invites?token=' + encodeURIComponent(invite)).then(async r => { const d = await r.json(); if (!r.ok) throw Error(d.error); invitation = d; last = ''; if (latest) render(latest, allowed); }).catch(e => { inviteError = e.message; last = ''; if (latest) render(latest, allowed); });
    $('host-access').hidden = true;
    $('twitch-config').hidden = true;
    $('setup-title').textContent = 'Your stream, ready to play.';
    $('camp-link').textContent = 'Camp';
    $('viewer-message').value = 'Type !join for your explorer, then !dig to climb. At the cache: !keep saves your loot, !risk tries for more.';
    document.querySelector('.technical').innerHTML = '<summary>Limits & usage</summary><p>Normal climbs and practice are free. AI caves need account access from the app owner. Each cave uses one request; retries also use a request.</p><p id="hosted-usage"></p><p>Chat, Hype Train and gift subs connect through Twitch. Event availability depends on your channel. Missed events during a Twitch outage cannot be replayed.</p><details id="operator-panel" hidden><summary>Operator controls</summary><div id="operator-accounts"></div><p id="operator-cost"></p></details>';
    const controls = document.createElement('div'); controls.className = 'setup-actions'; controls.id = 'camp-admin';
    controls.innerHTML = '<button id="view-camp">View my camp</button><button id="pause-camp">Pause new climbs</button><button id="close-camp">Close camp</button>';
    $('start-live').parentElement.append(controls);
    const preview = () => latest?.account ? `${location.origin}/overlay?channel=${encodeURIComponent(latest.account.overlay)}` : '';
    const copy = (button, input) => { $(button).onclick = async () => { try { await navigator.clipboard.writeText($(input).value); $(button).textContent = 'Copied'; } catch { $(input).focus(); $(input).select(); } }; };
    copy('copy-overlay', 'overlay-url'); copy('copy-viewer-message', 'viewer-message');
    $('obs-added').onchange = () => { if (latest) render(latest, allowed); };
    $('start-live').onclick = () => action('live').then(() => location.hash = 'camp').catch(fail);
    $('return-demo').onclick = () => action('demo').then(() => location.hash = 'home').catch(fail);
    $('view-camp').onclick = () => action('camp').then(() => location.hash = 'camp').catch(fail);
    $('pause-camp').onclick = () => action('pause').catch(fail);
    $('close-camp').onclick = () => action('close').catch(fail);
    $('channels').onclick = async event => {
        const button = event.target.closest('button[data-hosted]'); if (!button) return;
        button.disabled = true;
        try {
            switch (button.dataset.hosted) {
                case 'logout': await request('/api/logout', {}); location.reload(); break;
                case 'invite': { const result = await request('/api/invites', {}); $('invite-url').value = result.url; $('invite-result').hidden = false; break; }
                case 'copy': try { await navigator.clipboard.writeText($('invite-url').value); button.textContent = 'Copied'; } catch { $('invite-url').select(); } break;
                case 'accept': await request('/api/invites/accept', { token: invite }); sessionStorage.removeItem('camp-invite'); history.replaceState(null, '', '/#camp'); location.reload(); break;
                case 'leave': await request('/api/partner/leave', {}); location.reload(); break;
            }
        } catch (e) { fail(e); } finally { button.disabled = false; }
    };
    $('settings-form').onsubmit = async event => {
        event.preventDefault();
        try {
            await action('settings', { settings: { slots: Number($('slots').value), cooldownSeconds: Number($('cooldown').value), side: $('side').value, avatarSize: Number($('avatar-size').value), autoDigOnJoin: $('auto-dig').checked, giftRocks: $('gift-rocks').checked } });
            $('settings-feedback').textContent = latest.practice ? 'Practice settings saved.' : 'Your channel settings are saved.';
        } catch (e) { fail(e); }
    };
    $('operator-accounts').onclick = async e => {
        const b = e.target.closest('button[data-ai]'); if (!b) return;
        try { await request('/api/admin/ai', { login: b.dataset.ai, enabled: b.dataset.enable === 'true' }); await operator(); } catch (error) { fail(error); }
    };
    let operatorLoaded = false;
    async function operator() {
        const r = await fetch('/api/admin'); if (!r.ok) return; const d = await r.json();
        $('operator-panel').hidden = false;
        $('operator-accounts').innerHTML = d.accounts.map(a => `<p>${esc(a.login)} <button data-ai="${esc(a.login)}" data-enable="${!a.enabled}">${a.enabled ? 'Disable' : 'Enable'} AI</button></p>`).join('');
        $('operator-cost').textContent = `$100 project budget · hosting ${d.budget.hostingMonthlyEstimate ? '$' + d.budget.hostingMonthlyEstimate + '/month estimated' : 'not recorded'} · AI dollar total: check provider billing.`;
    }
    function render(data, canAct) {
        latest = data; allowed = canAct; const { account: a, room, state: s, capabilities: c } = data;
        const channel = a ? (data.practice ? data.liveChannel : s.channels[a.team]) : null;
        const connected = channel?.status === 'connected';
        const key = JSON.stringify([a, room, channel, c.twitch, invitation, inviteError]);
        if (key !== last) {
            last = key;
            $('channels').innerHTML = !a ? `<a class="button-link primary" href="/auth/twitch" ${c.twitch ? '' : 'hidden'}>Sign in with Twitch</a>${invitation ? `<p>${esc(invitation.login)} invited you. Sign in to accept.</p>` : ''}` : `<div class="channel"><div><strong>${esc(a.login)}</strong><p>${esc(channel?.note || 'Connecting Twitch…')}</p><small>Chat: ${connected ? 'connected' : 'reconnecting'} · Hype: ${channel?.hypeAvailable ? 'connected' : 'unavailable'} · Gifts: ${channel?.giftsAvailable ? 'connected' : 'unavailable'}</small></div><a href="/auth/twitch">Reconnect</a></div><button class="quiet" data-hosted="logout">Sign out</button><details class="partner-setup"><summary>${room.paired ? 'Linked to ' + esc(room.partner) : 'Invite another streamer'} <small>OPTIONAL</small></summary><p>Keep loot to send rescue ropes. Both streams see both camps.</p>${room.paired ? '<button data-hosted="leave">Unlink camps</button><small>Pause and finish climbs first.</small>' : '<button data-hosted="invite">Create invite link</button><div id="invite-result" hidden><input id="invite-url" readonly aria-label="Partner invitation"><button data-hosted="copy">Copy invite</button><small>One use · expires in 24 hours</small></div>'}</details>${invitation ? `<div class="invite-offer"><strong>Join ${esc(invitation.login)}’s camp?</strong><p>${invitation.slots} climbers · ${invitation.roomSeconds}s per room. These shared rules stay fixed while linked. Your channel keeps its own event settings.</p><button class="primary" data-hosted="accept">Accept invite</button><small>Finish active climbs in both camps first.</small></div>` : ''}`;
            if (inviteError) { const p = document.createElement('p'); p.textContent = inviteError; $('channels').append(p); }
        }
        $('twitch-help').textContent = !c.twitch ? 'Twitch signup is not ready yet. Try a free practice climb.' : a ? 'Your OBS link stays the same when you link or unlink camps.' : 'Only streamers sign in. Viewers play in chat.';
        $('setup-next').textContent = !c.twitch ? 'Try a free practice climb below.' : !a ? 'Next: sign in with Twitch.' : !connected ? 'Waiting for Twitch. Reconnect above if access expired.' : !room.open ? 'Next: copy your OBS link, then open camp.' : data.practice ? 'You’re practicing. Your live camp keeps running separately.' : 'Camp open. Viewers type !join, then !dig.';
        $('overlay-url').value = preview(); $('copy-overlay').disabled = !a;
        $('obs-note').textContent = a ? 'Read-only stream view. This link stays yours in solo and paired play.' : 'Your OBS link appears after sign-in.';
        document.querySelector('.setup-actions a').href = a ? preview() + '&preview=1' : '#setup';
        document.querySelector('.preview-top a').href = data.practice ? '/overlay?practice=1&preview=1' : preview() + '&preview=1';
        $('start-live').disabled = !canAct || !a || !connected || (room?.open && !room.paused) || (!room?.owner && (!room?.open || room?.paused));
        $('start-live').textContent = room?.open ? room.paused ? 'Resume camp' : 'Camp is open' : 'Open camp';
        $('live-status').textContent = room?.open ? 'Viewers control their own explorers in Twitch chat.' : 'Built-in caves are free. Opening camp uses no AI requests.';
        $('viewer-check').textContent = data.practice ? 'Practice viewers are simulated.' : `${s.players.length} viewers in camp.`;
        $('camp-admin').hidden = !a; $('view-camp').hidden = !data.practice;
        $('pause-camp').hidden = $('close-camp').hidden = !room?.open || !room.owner || data.practice;
        $('pause-camp').textContent = room?.paused ? 'Resume new climbs' : 'Pause new climbs';
        $('close-camp').disabled = Boolean(s.runs.length) || !canAct;
        $('return-demo').hidden = false; $('return-demo').textContent = 'Try free practice'; $('return-demo').disabled = !canAct;
        $('settings-form').querySelector('button[type=submit]').disabled = !canAct;
        const skey = `${s.id}:${data.practice}:${a?.id}`;
        if (settingsKey !== skey) {
            settingsKey = skey; $('slots').value = s.settings.slots; $('cooldown').value = s.settings.cooldownSeconds; $('side').value = s.settings.side; $('avatar-size').value = s.settings.avatarSize; $('auto-dig').checked = s.settings.autoDigOnJoin; $('gift-rocks').checked = s.settings.giftRocks;
        }
        $('slots').disabled = !data.practice && Boolean(room?.paired);
        $('hosted-usage').textContent = `${c.ai.requests} / ${c.ai.maxRequests} AI requests used · ${c.ai.inputTokens || 0} input / ${c.ai.outputTokens || 0} output tokens. ${c.ai.enabled ? 'AI enabled for your account.' : 'Built-in caves available.'}`;
        if (a && !operatorLoaded) { operatorLoaded = true; void operator(); }
    }
    return render;
}
