export function createEventControls({ action, fail, current }) {
    const root = document.getElementById('event-controls');
    const enabled = document.getElementById('test-gift-rocks');
    const feedback = document.getElementById('gift-feedback');
    let session = '';
    let trackedGift = null;
    enabled.onchange = () => action('settings', { settings: { giftRocks: enabled.checked } }).then(() => {
        trackedGift = null;
        feedback.textContent = enabled.checked ? 'On for new climbs. Start a climb, choose Risk it, then test a gift.' : 'Gift rocks off. Incoming rocks cancelled.';
    }).catch(error => { enabled.checked = !enabled.checked; fail(error); });
    root.onclick = event => {
        const button = event.target.closest('button');
        const { state, player } = current();
        if (!button || !player || state.mode !== 'demo') return;
        if (button.dataset.hype) action('hype', { team: player.team, level: Number(button.dataset.hype) }).catch(fail);
        if (button.dataset.gift) action('gift', { team: player.team, total: Number(button.dataset.gift) }).then(data => {
            trackedGift = data.state.rocks.find(rock => rock.message === data.feedback)?.id || null;
            feedback.textContent = data.feedback;
        }).catch(fail);
    };
    return (state, player, unlocked) => {
        root.hidden = state.mode !== 'demo' || Boolean(state.practice && !state.practice.done);
        enabled.checked = state.settings.giftRocks;
        enabled.disabled = !unlocked;
        if (session !== state.id) { session = state.id; trackedGift = null; feedback.textContent = 'Turn on gift rocks, start a climb, then choose Risk it.'; }
        const gift = state.rocks.find(rock => rock.id === trackedGift);
        if (gift) feedback.textContent = gift.message;
        const hype = player && state.hype[player.team];
        for (const button of root.querySelectorAll('button')) {
            button.disabled = !unlocked || !player;
            if (button.dataset.hype) {
                const on = Number(button.dataset.hype) === (hype?.level >= 3 ? 3 : hype ? 1 : 0);
                button.classList.toggle('selected', on);
                button.setAttribute('aria-pressed', String(on));
            }
        }
    };
}
