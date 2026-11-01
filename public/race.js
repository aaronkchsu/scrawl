import { esc } from './doodles.js';

export const teamOrder = perspective => [perspective, perspective === 'a' ? 'b' : 'a'];

export function resultTitle(state, perspective) {
  if (!state.winner) return 'Race in progress';
  if (state.winner === 'tie') return 'Draw';
  if (perspective) return state.winner === perspective ? 'You win!' : 'You lose';
  return `${state.teams[state.winner].name} wins`;
}

export function resultExplanation(state) {
  if (state.resultReason === 'same-round') return 'Both bosses were defeated in the same round.';
  if (state.resultReason === 'boss-defeated') return `${state.teams[state.winner].name} defeated its boss first.`;
  if (state.resultReason === 'round-limit') return state.winner === 'tie'
    ? 'Two rounds played. Both bosses have the same health left.'
    : `Two rounds played. ${state.teams[state.winner].name} dealt more damage to its boss.`;
  return 'Defeat your boss first. Same-round defeats draw. After two rounds, most damage wins.';
}

export function bossMeters(state, perspective, hostControls) {
  return teamOrder(perspective).map(id => {
    const t = state.teams[id], boss = t.boss;
    const status = state.winner ? state.winner === 'tie' ? 'DRAW' : state.winner === id ? 'WINNER' : 'LOSER' : hostControls ? 'BOSS HEALTH' : id === perspective ? 'YOUR BOSS' : 'OPPONENT’S BOSS';
    return `<section class="race-meter" data-boss="${id}" style="--team-color:${t.color}">
      <div><strong>${esc(t.name)}</strong><span>${status}</span></div>
      <div><div class="health-track" role="progressbar" aria-label="${esc(t.name)} boss health" aria-valuenow="${boss.health}" aria-valuemin="0" aria-valuemax="${boss.maxHealth}"><div style="width:${100 * boss.health / boss.maxHealth}%"></div></div><strong>${boss.health} / ${boss.maxHealth}</strong></div>
    </section>`;
  }).join('');
}
