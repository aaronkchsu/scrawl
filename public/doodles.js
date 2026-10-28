export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ink = '#202936';
const style = `stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"`;
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${style} ${extra}/>`;
const ellipse = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${style} ${extra}/>`;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" ${style} ${extra}/>`;
const eye = (x, y) => ellipse(x, y, 6, 8, ink, 'stroke="none"');

function duck() { return `${path('M127 231 Q96 218 84 187 L114 194 Q127 152 170 159 Q185 145 185 123 Q182 79 218 76 Q250 72 255 107 L276 119 L252 135 Q252 164 223 183 Q235 228 196 245 Q157 257 127 231Z', '#f9d45c')}${path('M251 107 L281 117 L252 132Z', '#f3a476')}${path('M124 194 Q154 173 179 198 Q164 220 144 212', '#f3a476')}${eye(232, 102)}${path('M210 86 Q216 80 221 85')}${path('M180 79 L174 67 M187 77 L188 62')}${path('M149 247 L145 271 L125 272 M194 246 L201 269 L220 270')}`; }
function robot() { return `${rect(112, 133, 125, 111, '#8baea0', 'transform="rotate(-4 175 185)"')}${path('M174 132 L177 111 M164 120 L188 120')}${rect(130, 66, 105, 62, '#8baea0', 'transform="rotate(4 175 95)"')}${ellipse(183, 97, 25, 19, '#f7f2e6')}${eye(188, 98)}${path('M141 90 L152 89 M150 114 L213 118')}${rect(152, 165, 49, 38, '#f9d45c')}${path('M163 178 L186 175 L179 192')}${path('M114 164 L87 178 L92 202 M238 163 L262 175 L257 203 M145 244 L141 267 L123 269 M204 244 L210 266 L229 267')}${ellipse(93, 207, 9, 10, '#f3a476')}${ellipse(255, 207, 9, 10, '#f3a476')}`; }
function cat() { return `${path('M119 224 Q116 176 147 154 L143 84 L177 106 Q195 99 213 107 L246 88 L238 157 Q269 194 237 231 Q210 251 165 243Z', '#d995a8')}${path('M134 213 Q81 212 92 182 Q98 171 105 181')}${eye(173, 137)}${eye(215, 140)}${path('M189 151 L198 151 L194 157Z', '#f3a476')}${path('M194 157 L193 166 L181 169 M193 166 L207 171 M147 147 L121 141 M147 157 L121 159 M238 151 L262 148 M236 161 L260 168 M160 244 L156 269 L136 270 M218 243 L222 268 L242 270')}`; }
function frog() { return `${ellipse(188, 200, 76, 50, '#8baea0')}${ellipse(187, 139, 75, 49, '#8baea0')}${ellipse(150, 101, 22, 25, '#8baea0')}${ellipse(219, 101, 22, 25, '#8baea0')}${eye(152, 100)}${eye(221, 101)}${path('M149 145 Q185 176 226 144 M137 232 L113 265 L145 268 M230 234 L253 263 L221 269')}`; }
const equipment = {
  sponge: () => `<g class="tool-wobble">${path('M130 185 L91 161')}${path('M59 125 L113 118 L123 173 L66 180Z', '#f9d45c')}${[ [75, 140], [98, 135], [84, 157], [106, 160], [73, 169] ].map(([x,y]) => ellipse(x,y,3,3,'#c5a94c','stroke-width="1"')).join('')}${path('M62 191 Q57 208 63 210 Q72 208 62 191Z','#6f89c7')}</g>`,
  bucket: () => `${path('M224 188 L261 173 M242 165 Q246 118 269 133 Q285 144 276 166')}${path('M240 164 L285 164 L278 209 L250 209Z', '#6f89c7')}${ellipse(262, 165, 22, 6, '#f7f2e6')}`,
  boots: () => `<g class="feet-wiggle">${path('M133 248 L159 247 L161 272 L179 277 L177 291 L126 290Z', '#f3a476')}${path('M194 247 L217 248 L218 272 L239 275 L237 290 L189 291Z', '#f3a476')}${path('M128 284 L176 285 M191 284 L236 284')}</g>`,
  umbrella: () => `<g class="tool-wobble">${path('M204 188 L216 50 Q220 38 228 47')}${path('M139 66 Q201 -16 271 75 Q247 59 229 73 Q207 54 185 70 Q167 56 139 66Z', '#6f89c7')}${path('M203 15 Q186 31 185 70 M203 15 Q231 32 229 73')}${path('M206 13 L207 4')}</g>`,
  mirror: () => `${path('M226 185 L266 160 L281 164')}${ellipse(286, 130, 31, 45, '#6f89c7', 'transform="rotate(12 286 130)"')}${ellipse(286, 130, 24, 36, '#f7f2e6', 'transform="rotate(12 286 130)"')}${path('M278 118 L291 104 M280 139 L301 115')}`,
  wheels: () => `${path('M109 274 L238 275')}${ellipse(131, 284, 17, 17, '#6f89c7')}${ellipse(218, 284, 17, 17, '#6f89c7')}${ellipse(131,284,5,5,'#f7f2e6')}${ellipse(218,284,5,5,'#f7f2e6')}${path('M70 246 L96 247 M60 258 L89 258')}`,
  wire: () => `${path('M228 194 Q286 208 278 254 Q273 291 307 291 L319 291', 'none', 'stroke="#f3a476" stroke-width="7"')}${path('M319 279 L319 306 M306 287 L332 287 M309 297 L329 297')}`,
  magnet: () => `${path('M237 179 L274 202')}${path('M260 175 L259 207 Q269 236 295 217 L307 185 L290 179 L280 205 Q273 208 275 201 L279 180Z', '#f3a476')}${path('M260 185 L277 188 M289 189 L303 194')}`,
  party: () => `${path('M174 79 L189 13 L230 83Z', '#f3a476')}${ellipse(189,15,7,7,'#f9d45c')}${path('M183 45 L210 62 M179 62 L219 76')}${path('M277 82 L283 67 L290 72 M286 96 L296 92')}`,
};

export function creationSVG(creation, color = '#ee7544') {
  if (creation.body === 'blank') return `<g opacity=".45"><ellipse cx="185" cy="184" rx="70" ry="65" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="5 9"/><text x="185" y="195" text-anchor="middle" class="svg-hand" font-size="42" fill="${ink}">?</text><text x="185" y="290" text-anchor="middle" class="svg-meta" fill="${ink}">WAITING FOR CHAT’S FIRST IDEA</text></g>`;
  if (creation.origin === 'ai' && creation.shapes?.length) {
    return ['feet', 'body', 'tool'].map(layer => `<g class="${layer === 'tool' ? 'tool-wobble' : layer === 'feet' ? 'feet-wiggle' : 'creation-body'}">${creation.shapes.filter(s => s.layer === layer).map(s => {
      const base = `fill="${esc(s.fill)}" ${style}`;
      const attrs = `${base} transform="rotate(${Number(s.angle)} ${Number(s.x)} ${Number(s.y)})"`;
      if (s.kind === 'path') return `<path d="${esc(s.path)}" ${base} transform="translate(${Number(s.x)} ${Number(s.y)}) rotate(${Number(s.angle)})"/>`;
      if (s.kind === 'ellipse') return `<ellipse cx="${s.x}" cy="${s.y}" rx="${Math.abs(s.w)/2}" ry="${Math.abs(s.h)/2}" ${attrs}/>`;
      if (s.kind === 'line') return `<line x1="${s.x}" y1="${s.y}" x2="${s.x+s.w}" y2="${s.y+s.h}" ${attrs}/>`;
      return `<rect x="${s.x}" y="${s.y}" width="${Math.abs(s.w)}" height="${Math.abs(s.h)}" rx="4" ${attrs}/>`;
    }).join('')}</g>`).join('');
  }
  const body = ({duck,robot,cat,frog})[creation.body] ?? robot;
  return `<g class="creation-body">${body()}</g>${(creation.features ?? []).map(f => equipment[f]?.() ?? '').join('')}<path d="M115 313 Q177 305 239 314" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
}

export function monsterSVG(storm = false, defeated = false) {
  return `<g class="monster-body ${defeated ? 'monster-defeated' : ''}">
  ${ellipse(170, 291, 112, 15, '#202936', 'opacity=".12" stroke="none"')}
  ${path('M87 263 Q68 225 82 178 Q57 161 76 136 L95 118 Q93 85 128 90 Q143 54 170 79 Q192 61 211 90 Q246 76 252 112 Q279 111 265 143 Q299 179 267 220 L264 253 Q259 279 236 267 L214 276 L193 260 Q168 283 147 264 Q122 286 103 264 L87 263Z', '#202936')}
  ${path('M99 161 Q66 150 45 173 L54 194 Q69 176 90 188', '#202936')}
  ${path('M259 165 Q292 156 309 184 L297 199 Q278 179 262 193', '#202936')}
  ${ellipse(174, 143, 48, 43, '#f7f2e6')}${ellipse(182,146,15,22,'#202936')}${ellipse(188,137,4,6,'#f7f2e6','stroke="none"')}
  ${path('M126 204 Q170 236 224 201 L215 229 Q168 252 135 228Z', '#f7f2e6')}${path('M153 219 L153 236 M179 223 L179 240 M202 216 L202 234')}
  ${path('M115 116 L125 109 M229 116 L237 125', '#f7f2e6', 'stroke="#f7f2e6" stroke-width="3"')}
  ${path('M111 262 L101 291 L122 290 M230 264 L245 291 L226 291')}
  ${storm ? `<g class="storm-cloud">${path('M108 39 Q91 16 113 9 Q129 -10 146 5 Q166 -13 185 4 Q205 -4 215 14 Q243 22 222 41Z','#6f89c7')}${path('M160 43 L145 65 L162 63 L153 84 L181 56 L166 57 L179 39Z','#f9d45c')}</g>` : `${path('M147 61 L138 40 M171 52 L173 27 M195 64 L208 45')}`}
  </g>`;
}

const preview = id => ({ body: id === 'a' ? 'duck' : 'robot', features: id === 'a' ? ['sponge','wheels'] : ['umbrella','bucket'], origin:'demo' });
export function stageSVG(state, perspective = 'a') {
  const own = state.teams[perspective]; const other = state.teams[perspective === 'a' ? 'b' : 'a'];
  const lobby = state.phase === 'lobby';
  const creature = team => lobby ? preview(team.id) : team.creation;
  const impact = state.phase === 'resolving';
  const finishing = state.phase === 'finishing';
  const defeated = ['finishing','finished'].includes(state.phase) && state.boss.health === 0;
  const label = (team, x, local) => `<g transform="translate(${x} 432)"><rect x="-127" y="-19" width="254" height="39" rx="4" fill="${team.color}" opacity=".12"/><text y="5" text-anchor="middle" class="svg-team" fill="${ink}">${esc(team.name)}</text><text y="43" text-anchor="middle" class="svg-meta" fill="${ink}">${local ? 'YOUR COMMUNITY' : 'PARTNER COMMUNITY'}${lobby ? '' : ` · ${team.score} IMPACT`}</text></g>`;
  return `<svg class="battle-svg ${impact ? 'is-attacking' : ''}" viewBox="0 0 1100 490" role="img" aria-label="${esc(state.boss.name)} between ${esc(own.name)} and ${esc(other.name)}. Both communities are visible on this stream.">
  <defs><pattern id="ruled" width="1100" height="33" patternUnits="userSpaceOnUse"><path d="M0 32.5H1100" stroke="#7da3ba" stroke-opacity=".17" stroke-width="1"/></pattern></defs>
  <rect width="1100" height="490" fill="url(#ruled)"/><path d="M46 0V490" stroke="#df958d" stroke-opacity=".45"/>
  <g fill="none" stroke="${ink}" stroke-width="2" opacity=".32"><path d="M80 61L87 77L105 72L94 88L105 103L85 96L73 109L76 88L61 79L80 79Z"/><path d="M1002 79q30 -20 20 12q-14 14 -8 24m-1 7v3"/><path d="M493 361q58 15 117 0M488 367q64 13 129 -1"/></g>
  <text x="550" y="52" text-anchor="middle" class="svg-hand boss-label">${finishing ? 'THE COLLECTIVE FINISHER' : defeated ? 'THOROUGHLY OUT-DOODLED.' : state.round === 2 ? 'IT STOLE A STORM CLOUD?!' : 'THE INKLING'}</text>
  <text x="550" y="76" text-anchor="middle" class="svg-meta" fill="${ink}" opacity=".6">${lobby ? 'ONE MONSTER. TWO COMMUNITIES. QUESTIONABLE IDEAS.' : state.phase === 'building' ? 'CHAT IS HOLDING THE PENCIL' : state.phase === 'generating' ? 'ASSEMBLING THE COLLECTIVE IMAGINATION…' : state.phase === 'reveal' ? 'PENCILS DOWN. BRACE YOURSELVES.' : 'LOOK WHAT YOU MADE.'}</text>
  <g class="team-creature team-left" transform="translate(27 155) scale(.83)">${creationSVG(creature(own), own.color)}</g>
  <g class="team-creature team-right" transform="translate(763 155) scale(.83)">${creationSVG(creature(other), other.color)}</g>
  <g transform="translate(390 104)">${monsterSVG(state.round === 2, defeated)}</g>
  ${impact ? `<g class="projectile projectile-left"><path d="M310 251q28 -31 56 0q-23 37 -56 0" fill="${own.color}" ${style}/><path d="M301 246l-18 -4m17 15l-24 5" ${style}/></g><g class="projectile projectile-right"><path d="M785 252q-29 -29 -53 0q23 35 53 0" fill="${other.color}" ${style}/><path d="M794 246l20 -5m-20 15l24 4" ${style}/></g><text x="550" y="385" text-anchor="middle" class="svg-hand impact-word">${defeated ? 'SPLAT!' : 'BONK!'}</text>` : ''}
  ${finishing ? `<g class="finisher-move" aria-label="${esc(own.creation.name)} and ${esc(other.creation.name)} combine in one finishing move"><path class="finisher-beam-left" d="M305 300 Q420 185 550 253" fill="none" stroke="${own.color}" stroke-width="13" stroke-linecap="round"/><path class="finisher-beam-right" d="M798 300 Q684 185 550 253" fill="none" stroke="${other.color}" stroke-width="13" stroke-linecap="round"/><g class="finisher-star"><path d="M550 157L569 211L620 190L601 240L660 260L601 279L624 326L571 306L550 360L530 307L478 327L499 279L443 260L499 240L480 190L531 212Z" fill="#f9d45c" ${style}/></g><g transform="translate(440 188) scale(.32)">${creationSVG(own.creation,own.color)}</g><g transform="translate(531 190) scale(.32)">${creationSVG(other.creation,other.color)}</g><text x="550" y="378" text-anchor="middle" class="svg-hand boss-label">TOGETHER!</text><text x="190" y="140" text-anchor="middle" class="finisher-caption">${esc(own.creation.name.slice(0,43))}</text><text x="914" y="140" text-anchor="middle" class="finisher-caption">${esc(other.creation.name.slice(0,43))}</text></g>` : ''}
  ${label(own,190,true)}${label(other,914,false)}
  ${state.phase === 'finished' ? `<g transform="translate(550 426) rotate(-7)"><rect x="-157" y="-33" width="314" height="62" rx="3" fill="#f7f2e6" stroke="${state.winner === 'boss' || (state.winner !== perspective && state.winner !== 'tie') ? '#c45c49' : '#3b7362'}" stroke-width="4"/><text text-anchor="middle" y="8" class="svg-hand result-stamp" fill="${state.winner === 'boss' || (state.winner !== perspective && state.winner !== 'tie') ? '#c45c49' : '#3b7362'}">${state.winner === 'boss' ? 'THE MONSTER WINS' : state.winner === 'tie' ? 'SHARED VICTORY!' : state.winner === perspective ? 'YOUR CHAT WINS!' : 'SEE ME AFTER CLASS'}</text></g>` : ''}
  </svg>`;
}
