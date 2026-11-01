import { avatar } from './expedition-avatar.js';

// The guide observes ordinary demo runs. It never changes rewards or route odds.
export function firstClimber(state, now) {
    if (state.mode !== 'demo' || state.practice) return null;
    return state.players.find(p => !state.runs.some(r => r.playerId === p.id)
        && !state.queue.some(q => q.playerId === p.id) && (p.digReadyAt ?? 0) <= now) ?? null;
}

export function guideStep(state, guide) {
    if (!guide || state.id !== guide.sessionId || state.mode !== 'demo' || state.practice) return null;
    const player = state.players.find(p => p.id === guide.playerId);
    if (!player) return null;
    const run = state.runs.find(r => r.playerId === player.id && (!guide.runId || r.id === guide.runId));
    if (run?.phase === 'choice') return { step: '2 / YOUR CHOICE', text: `${player.name} found loot. Choose Keep to save it, or Risk to try for more.` };
    if (run?.phase === 'climbing') return { step: run.floor < 3 ? '1 / WATCH YOUR EXPLORER' : '3 / HEADING HIGHER', text: run.floor < 3 ? `${player.name} climbs on the side of the stream. You’ll choose what happens at room 3.` : 'The upper rooms are riskier. Watch the hearts and the loot bag.' };
    if (!run && state.queue.some(q => q.playerId === player.id)) return { step: '1 / WAITING FOR A SPOT', text: `${player.name} is in line. The climb starts automatically when a spot opens.` };
    return { step: '3 / DONE', text: run?.phase === 'lost' ? 'The fall lost this climb’s loot. Your XP and earlier items are safe. Open Backpack to see your gear.' : 'Your climb is finished. Open Backpack to see what you kept. Try a rescue next to see two camps help each other.' };
}

export function createOnboarding({ action, current, select, fail }) {
    const $ = id => document.getElementById(id);
    const key = 'excavation-first-climb';
    let guide = null, starting = false, allowed = false;
    try { guide = JSON.parse(sessionStorage.getItem(key)); } catch { /* A guide is optional. */ }
    const save = () => { try { guide ? sessionStorage.setItem(key, JSON.stringify(guide)) : sessionStorage.removeItem(key); } catch { /* Game progress is saved by the server. */ } };
    $('welcome-explorers').innerHTML = ['demo:noodle', 'demo:peach', 'demo:luna', 'demo:mossboss'].map(id => avatar({ id })).join('');
    $('end-first-climb').onclick = () => { guide = null; save(); $('first-climb-guide').hidden = true; $('player-select').disabled = false; render(current(), allowed); };
    $('first-climb').onclick = async () => {
        if (starting) return;
        const data = current();
        if (!data) return;
        if (data.state.mode !== 'demo' || data.state.practice) { location.hash = 'camp'; return; }
        if (guideStep(data.state, guide)) { select(guide.playerId); location.hash = 'camp'; return; }
        const player = firstClimber(data.state, data.now);
        if (!player) return;
        starting = true;
        $('first-climb').disabled = true;
        try {
            select(player.id);
            const result = await action('dig', { playerId: player.id });
            guide = { sessionId: result.state.id, playerId: player.id, runId: result.state.runs.find(r => r.playerId === player.id)?.id };
            save();
            render(result, true);
            location.hash = 'camp';
            $('first-climb-guide').scrollIntoView({ block: 'nearest' });
        } catch (e) { fail(e); }
        finally { starting = false; }
    };
    function render(data, canAct) {
        if (!data) return null;
        allowed = canAct;
        const { state, now } = data;
        const step = guideStep(state, guide);
        if (guide && !step) { guide = null; save(); }
        $('first-climb-guide').hidden = !step;
        if (step) {
            const run = state.runs.find(r => r.playerId === guide.playerId);
            if (!guide.runId && run) { guide.runId = run.id; save(); }
            $('first-climb-step').textContent = step.step;
            $('first-climb-instruction').textContent = step.text;
        }
        const live = state.mode !== 'demo', practice = Boolean(state.practice);
        $('first-climb').textContent = live ? 'Open live camp →' : practice ? 'Continue rescue practice →' : step ? 'Continue my climb →' : 'Try a climb →';
        $('first-climb').disabled = !(live || practice || (canAct && (step || firstClimber(state, now)))) || starting;
        $('first-climb-status').textContent = live ? 'Twitch is live. Play in your channel’s chat.' : practice ? 'Your rescue practice is in progress.' : !canAct ? 'Server disconnected or controls locked. Check Set up stream.' : !step && !firstClimber(state, now) ? 'Your test viewers are climbing or resting. A spot will open shortly.' : 'Free · simulated viewer · pauses for your choice';
        return step && step.step !== '3 / DONE' ? guide.playerId : null;
    }
    return render;
}
