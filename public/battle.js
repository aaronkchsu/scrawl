import { creationSVG, monsterSVG, esc } from './doodles.js';
import { teamOrder } from './race.js';

const preview = id => ({ body: id === 'a' ? 'duck' : 'robot', features: id === 'a' ? ['sponge','wheels'] : ['umbrella','bucket'], origin:'demo' });

function fightSVG(state, team) {
  const drawing = state.phase === 'lobby' ? preview(team.id) : team.creation;
  const attacking = state.phase === 'resolving';
  const defeated = team.boss.health === 0;
  const finished = ['finishing','finished'].includes(state.phase);
  const stamp = state.winner === 'tie' ? 'DRAW' : state.winner === team.id ? 'WINNER' : 'LOSER';
  return `<svg class="fight-svg ${attacking ? 'is-attacking' : ''}" viewBox="0 0 520 340" role="img" aria-label="${esc(team.name)}’s fighter facing its own boss. Boss health ${team.boss.health} of ${team.boss.maxHealth}.">
    <defs><pattern id="ruled-${team.id}" width="520" height="28" patternUnits="userSpaceOnUse"><path d="M0 27.5H520" stroke="#7da3ba" stroke-opacity=".18"/></pattern></defs>
    <rect width="520" height="340" fill="url(#ruled-${team.id})"/><path d="M22 0V340" stroke="#df958d" stroke-opacity=".4"/>
    <text x="370" y="28" text-anchor="middle" class="svg-meta" fill="#202936">${defeated ? 'BOSS DEFEATED' : state.round === 2 ? 'LIGHTNING ATTACK' : 'INK ATTACK'}</text>
    <g transform="translate(-3 62) scale(.65)"><g class="race-fighter">${creationSVG(drawing,team.color)}</g></g>
    <g transform="translate(267 51) scale(.7)">${monsterSVG(state.round === 2,defeated)}</g>
    ${attacking && team.lastDamage > 0 ? `<g class="race-projectile"><path d="M216 176q25 -22 43 0q-17 28 -43 0" fill="${team.color}" stroke="#202936" stroke-width="3"/></g><text x="373" y="85" text-anchor="middle" class="svg-hand race-damage" fill="#b75542">−${team.lastDamage}</text>` : ''}
    <text x="119" y="305" text-anchor="middle" class="svg-meta" fill="#202936">FIGHTER · ${team.health} HP</text>
    <text x="386" y="305" text-anchor="middle" class="svg-meta" fill="#202936">${esc(team.boss.name.toUpperCase())}</text>
    ${finished ? `<g transform="translate(260 155) rotate(-6)"><rect x="-100" y="-31" width="200" height="62" rx="4" fill="#f7f2e6" stroke="${state.winner === team.id ? '#3b7362' : '#202936'}" stroke-width="3"/><text text-anchor="middle" y="9" class="svg-hand result-stamp" fill="#202936">${stamp}</text></g>` : ''}
  </svg>`;
}

export function battleScene(state, perspective) {
  return `<div class="race-arena">${teamOrder(perspective).map(id => {
    const team = state.teams[id];
    const picked = team.finalists.find(f => f.id === team.selectedId);
    const note = team.result || (picked ? `${picked.approach.label} · ${picked.approach.impact} damage` : 'Waiting for ideas');
    return `<section class="fight-lane" data-fight="${id}" style="--team-color:${team.color}"><h3 class="lane-name">${esc(team.name)} vs ${esc(team.boss.name)}</h3>${fightSVG(state,team)}<p class="fight-note">${esc(note)}</p></section>`;
  }).join('')}</div>`;
}
