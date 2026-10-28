# SCRAWL — Collective Doodle Battle

Two Twitch communities hold one pencil each. They nominate ideas, vote for a lead, and combine finalist details into ridiculous notebook inventions against a shared monster. Both communities are visible on either stream. Working title: **SCRAWL**.

## Run locally

Requires **Node 24** (`nvm use` if available).

```sh
npm install
npm run dev
```

Open **http://localhost:4177**. The launcher offers three paths:

- **Watch a demo:** one click starts a roughly 63-second, free, scripted encounter with simulated participants.
- **Rehearse an encounter:** choose free sample artwork or paid AI drawings, then edit both communities’ three sample ideas. Click **Open voting**, choose a card on each side, then **Draw both**. Inspect the drawings and credits for as long as you want before **Play fight**. The next round waits again. No Twitch accounts are needed.
- **Set up Twitch:** follow the channel connection and OBS checklist, then start a live encounter. Both channels must be connected. Live input comes only from Twitch.

Rehearsal drafts survive refreshes in the same browser tab. Editing, voting, and inspecting have no countdown; combat and the finisher play automatically. You can change either simulated vote without adding power. **End encounter** cancels the current match and returns home; finished rehearsals also offer **Rehearse again** and **Back to home**.

Free sample artwork is selected by default and cannot draw arbitrary new geometry. AI drawing starts only when you explicitly click the labeled drawing button: two API calls per round, four per complete encounter with both communities populated. An insufficient request budget blocks both drawings before either starts. Retrying can use more calls. Technical details and usage remain in the expandable panel below the main view.

This is an explicitly labeled offline demo, with authored vector art and deterministic interpretation of a small vocabulary. It is not evidence of live AI drawing or real Twitch community participation. Supported demo motifs: duck/goose, robot/tank, cat, frog; equipment includes sponge, bucket, boots, umbrella, mirror, wheels, magnet, party hat. The separately implemented live AI adapter creates new geometry from submitted chat, and has been verified locally with six manually submitted contributor messages. Real Twitch participation remains unverified.

## OBS views

- Community A: `http://localhost:4177/overlay?team=a`
- Community B: `http://localhost:4177/overlay?team=b`

Add each URL as an OBS Browser Source at **1920 × 1080**. Each perspective labels its own community and shows both inventions. The overlay is transparent while the match is in the lobby, appears when the host starts an encounter, and retains the result until reset. Add `&preview=1` to keep an idle preview visible in a regular browser. OBS may need browser-source refresh after server restart.

For two remote streamers, `localhost` will not connect them to each other. Deploy **one central server** and use its public HTTPS URL for both overlays. The local prototype has not yet been deployed or tested on two real streams.

## Connect Twitch

1. Copy `.env.example` to `.env` inside this project. Do not reuse the captions project's environment file or app registration.
2. Register a Twitch developer application with redirect URL `http://localhost:4177/auth/twitch/callback`. Twitch requires a verified account with 2FA for app registration.
3. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Restart the server.
4. In **Set up Twitch**, connect an account for each community. Owners authorize through Twitch. A different Twitch account is required for the second team; `force_verify` lets an owner choose the account explicitly.
5. Start an encounter. Only explicit game commands contribute; ordinary Twitch conversation is ignored:
   - During nominations: `!idea soak a teapot with a sponge cape`. Round 1 counters are `soak`, `catch`, `shield`; round 2 counters are `ground`, `reflect`, `shield`.
   - During the 12-second vote: `!vote 1`, `!vote 2`, or `!vote 3`. A viewer may change their vote; repeated votes do not stack.
   - Nominees can `!brace` during nominations, voting, drawing, or reveal. Each unique nominee’s brace counts once toward a participation ratio.

The local coordinator uses broadcaster user tokens with only `user:read:chat` and EventSub WebSockets. Tokens remain server-side in memory and are refreshed while the process runs; restarting requires reconnecting both accounts. It does not send messages to Twitch chat. Shared Chat messages forwarded from another source broadcaster are excluded to avoid double contribution. Network reconnects resubscribe; Twitch does not replay messages lost during an outage.

Before inviting real remote streamers, the hosted onboarding must provide each owner a scoped invitation link; the MVP currently connects accounts from the host dashboard. Do not distribute the host control token to viewers.

## Enable original AI drawings

Set `OPENAI_API_KEY` in this project's `.env`. Optionally set `OPENAI_MODEL` (default `gpt-6.1-sol`), then restart and choose **AI drawings** when preparing a rehearsal or live encounter.

After the vote, one request per nonempty team draws the selected lead invention and compatible visual details from the other finalists. Nomination intake and voting make no AI calls. Original geometry is drawn by our SVG renderer, not downloaded or executed as code. The adapter validates geometry, effects, and references to actual message IDs. No API key or Twitch token is returned to the browser.

- One valid nomination per viewer per round. Exact duplicate ideas across viewers are declined. A uniform reservoir retains up to 12 unique nominees; up to three are sampled for the vote. The earliest or loudest messages do not get preferential slots.
- Live AI outputs bounded geometry and must credit every provided finalist and include the voted counter. Combat uses the published counter, not AI-inferred extra powers.
- Structured output prevents malformed structure; it does **not** guarantee recognizable art or correct interpretation. A small manual trial has been measured; quality across varied real chat inputs remains unverified.
- `AI_MAX_REQUESTS=40` bounds attempts, including failed requests. Set `AI_USAGE_FILE=.runtime/ai-usage.json` to retain the ceiling and reported token usage across server restarts; without a ledger it resets per process. It is **not a dollar budget**. Interrupted requests may still incur charges without returning usage. The dashboard flags those requests separately. Use `npm start` during paid tests to avoid development watch restarts. Preserve the ledger on persistent storage when hosting.
- A timeout or invalid output holds the phase for both teams. The host can retry or reset. Late responses after reset cannot affect the next match.

## Encounter rules

The Inkling has 130 HP and two rounds. Each community gets one invention per round, regardless of audience size. The cycle is **35 seconds nominate → 12 seconds vote → drawing → 6 seconds reveal → 8 seconds combat**. Both communities wait for both drawings. Failed drawing requests preserve the selected recipes on screen and hold both teams; ties or no votes use a random draw among actual finalists. Fewer than three nominees yield fewer finalists; no synthetic suggestions are inserted.

The lead finalist sets the main creature/object and its counter. Other finalists contribute compatible visual details. This preserves multiple authors without another nomination, branch vote, or model call. The full ballot and locked recipe appear on both stream perspectives.

| Round | Counters | Fixed effect |
| --- | --- | --- |
| Ink spill | Soak / Catch / Shelter | Soak and Catch: 35 impact. Shelter: 18 impact and blocks 12 incoming damage. |
| Storm cloud | Ground / Reflect / Shelter | Ground and Reflect: 35 impact. Shelter: 18 impact and blocks 12 incoming damage. |

Complementary Soak + Catch or Ground + Reflect gives **+6 impact each**. Incoming ink damage is 24, reduced by shelter and the fraction of actual nominees who brace (up to 12). Non-nominee braces cannot inflate that fraction. Team health is tracked but does not independently decide the short prototype’s outcome: the boss surviving both rounds is a loss. Destroying it is a shared victory, regardless of individual impact totals.

On victory, both current inventions appear together in a five-second **Collective Finisher**, with both community names and actual contributor credits. It reuses existing art and makes no additional AI call.

One nomination, one active vote, a fixed finalist limit, and fixed effects prevent raw chat volume from multiplying combat power. They do **not** guarantee equal winning chances: larger communities can still have more people discovering good ideas. Audience fairness, strategic balance, and enjoyment require real playtests. This is a deliberately small counter ruleset, not AI arbitration or custom physics. There is no sabotage branch.

## Structure

```text
server.ts             HTTP, host sessions, read-only SSE snapshots
src/game.ts           Authoritative encounter state machine and scoring
src/collective.ts     Honest offline adapter and bounded AI context
src/selection.ts      Published counters, sampling, finalists and tie resolution
src/rehearsal.ts      Whole-form validation before simulated nominations are admitted
src/ai.ts             Optional structured live-AI drawing adapter
src/twitch.ts         OAuth, EventSub, token refresh and reconnects
src/fixtures.ts       Explicitly synthetic, replayable demo chat
public/               Launcher, rehearsal, Twitch setup, shared board and OBS views
tests/                Collective behavior, state, failure and HTTP tests
docs/                 Product plan, demo storyboard and real build evidence
```

The browser renders state but does not decide outcomes. A reconnect receives a full snapshot. Server memory is the source of truth; restarting loses the match and connected credentials. The first hosted pilot should use a single server instance; horizontal scaling/persistent matches are outside this MVP.

## Verify

```sh
npm run check
npm test
```

## Later hosting

The supplied Dockerfile runs the same Node application. Set `HOST=0.0.0.0`, `PORT` as required by the host, `BASE_URL=https://your-domain`, and a random `CONTROL_TOKEN` of at least 20 characters. Use HTTPS and an always-on single instance that supports streaming responses. Enter the control token in the dashboard; overlays remain read-only. Update the Twitch app's redirect URL to `https://your-domain/auth/twitch/callback`.

Local host controls are automatically unlocked only over loopback with same-origin checks. Public binding refuses to start without a strong control token. Keep `.env` and credentials out of Docker images and repositories. The prototype isn't a production multi-tenant service.

## Sources

- [Competition brief and requirements](https://twitchcon-codex.devpost.com/rules)
- [Twitch chat authentication](https://dev.twitch.tv/docs/chat/authenticating/)
- [EventSub WebSocket lifecycle](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/)
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OBS Browser Source](https://obsproject.com/kb/browser-source)

## Measured live AI trial — October 27, 2026

Two communities' six **manual test messages** produced original vector inventions, with all three authors credited per team: a one-wheel snail with a sponge tail (31 shapes, 23.4 seconds) and a booted jellyfish carrying a jar and umbrella (29 shapes, 26.8 seconds). Both were ready in 27.2 seconds. The monster remains authored artwork. See `artifacts/live-ai-first-pass.json` and `artifacts/scrawl-live-ai.png`.

Across six API attempts, three returned usage totaling 2,107 input and 6,052 output tokens. At the [gpt-6.1-sol standard rates](https://developers.openai.com/api/docs/models/gpt-6.1-sol) checked on October 27, 2026 ($2/M input, $10/M output), that is approximately **$0.064734** for reported usage. Three interrupted requests did not return usage and may add charges. A conservative allowance for this small test is about **$0.30** including those attempts, assuming standard pricing and up to their configured 6,500 output tokens each; this is an estimate, not an account invoice. Check the [OpenAI usage dashboard](https://platform.openai.com/usage) for the billed total. The initial verification ceiling was six requests and was exhausted. For the user’s next manual tests, the ceiling was raised to 14 total attempts: eight additional requests, enough for two two-round matches with both teams populated. No hosting charges were incurred by this local run.

## Voted shared-boss verification — October 27, 2026

The revised nomination → vote → drawing → combat → shared-finisher flow completed a real two-round AI match with six manually simulated authors. Each community had three finalists; one had 3 simulated voters and the other had 30. Both finished at 82 impact and shared the win. This validates fixed mechanical power, not equal creative skill or real audience fairness. Each drawing credited all three finalists. Parallel drawing times were 26.6 and 28.0 seconds per round. The finisher reused both drawings and made no API request.

Evidence: `artifacts/voted-live-ai-round-1.json`, `voted-live-ai-round-2.json`, `voted-live-ai-finisher.json`, `voted-live-ai-finished.json`, and `scrawl-shared-finisher-live-ai.png`. All input in this verification was synthetic manual test input, not real Twitch chat.

This verification used four requests: 3,145 input and 8,779 output tokens, approximately **$0.09408** at the standard rates cited above. Cumulative reported usage is now 5,252 input and 14,831 output tokens, approximately **$0.158814**, plus the same three earlier interrupted attempts with unknown billing. Ten of the 14 allowed attempts are used; four remain, enough for one complete two-round test. These are token-based estimates, not an account invoice.

## Guided rehearsal interfaces

State and SSE snapshots include `experience` (`demo`, `rehearsal`, or `live`) independently of artwork `mode` (`demo` or `ai`). The authenticated `/api/action` endpoint starts `demo`, `rehearse`, or live `start` experiences. `/api/rehearsal` accepts the current `matchId`, `round`, and an action: `ideas`, `vote`, `draw`, `retry`, or `fight`. Both communities’ form rows are validated before nomination; votes use stable simulated voter identities. Requests for older matches or rounds are rejected. The previous manual `/api/idea` endpoint returns an explanatory error; simulations belong in rehearsals. Overlays remain read-only.

Rehearsal holds are server-owned rather than paused browser timers. Reloading or opening another overlay cannot advance them. Draft text is stored only in that browser tab’s session storage; another tab receives presets until the host submits nominations. Restarting the server starts a new match and does not recover the prior draft.
