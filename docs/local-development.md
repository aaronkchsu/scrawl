# Local single-host development (legacy mode)

A small adventure around the edges of a Twitch stream. Viewers get their own explorer, climb for loot, and choose whether to keep it or risk the summit.

## Run it

Requires Node.js 24 or newer.

```sh
npm install
npm run dev
```

Open **http://localhost:4177/**. The app starts in demo mode. No Twitch connection or AI key is needed.

## Try one climb

1. Choose a simulated viewer and click **Start a climb**.
2. After about 12 seconds, choose **Keep ore** or **Risk it**. The demo waits for you.
3. Kept items appear in the backpack. Click **Equip** to use one on the next climb.

Choose other viewers to try up to three simultaneous climbs. When both camps have viewers waiting, starts alternate between camps; order stays first-in, first-out within each camp. Under **Test stream events**, the **2× ore** and **3× ore** buttons simulate a Hype Train for the selected viewer's channel. Restart demo clears active climbs and the queue; it keeps collected gear and XP.

## Make a cave with chat

1. Under **Chat makes the cave**, edit the three simulated viewers’ ideas. Drafts survive a page refresh.
2. Click **Create cave · 1 AI request**. This needs `OPENAI_API_KEY` on the server and uses the existing request cap. Normal climbs and rescue practice remain free.
3. Read the generated rule and open the contributor credits, then click **Try Camp B’s cave**. It picks an available simulated viewer for you.
4. At the cache, choose **Keep** to save the cave’s cosmetic find, or **Risk** to try the upper rooms. Banked finds appear in the backpack, with their contributors, and survive a server restart.

Live viewers submit `!idea bees`. Each viewer has one current idea; a new message replaces it. Copied ideas collapse. From a pool capped at 200 contributors per camp, the host’s request randomly selects up to six distinct ideas, with a minimum of three. Used ideas and their copies clear only after successful generation; unused/new/edited ideas remain eligible. Failed requests keep the previous playable cave and offer a retry of the exact selected ideas. Retrying is another paid attempt.

With two connected channels, one chat builds the other camp’s cave. A single channel builds its own. AI combines the ideas into a cave name, enemy and collectible pixel art, and one of three fixed route rules. Existing climbs keep their original cave. It does not train on viewers, assign arbitrary powers, or secretly change odds. Published route odds still account for the resulting rooms and equipped gear.

Current caves reset when you restart the demo, start rescue practice, switch modes/channel pairs, or restart the server. Collected finds persist (up to 20 per viewer). This is generative content, not a model learning audience preferences over time.

## Try a rescue

Click **Try a rescue** in the Playground. Follow four choices: **Keep → Risk → Keep → Risk**. The guide selects the right simulated viewer and waits for you each time. It restarts the demo, uses fixed falls, and costs nothing.

Noodle from Camp A sends a rope that saves Mossboss in Camp B. Mossboss returns the favor. Both earn a **Linked Lantern** keepsake with the camps and participants recorded. Open it below the backpack. Click **Back to playground** to resume ordinary climbs.

During ordinary play, choosing Keep banks your own loot and sends help when a partner camp is connected and the line is ready. The partner's next fatal fall consumes the rope and ends that climb safely with its collected loot, without a summit crown. Each camp can receive one rope; each can send once per minute. Ropes arrive after three seconds. Active Hype in the sending camp adds five ore to the eventual rescue. An automatic timeout banks loot but sends no rope. Solo climbing works without a partner.

## Try the stream events

- Click **2× ore** or **3× ore** under the preview to see gold Hype lighting and bonus pickups.
- Turn on **Gift rocks on new climbs**, then start a climb. At the checkpoint, choose **Risk it** and click **Test 1 gift sub** or **Test 10 gifts**.
- A random eligible climber in the selected viewer's channel gets an eight-second warning. The rock has a 35% chance of dealing 1 HP; an unused shield blocks it. Gift batches do not increase damage. There is one rock per climb and a 30-second channel cooldown.
- Existing climbs stay safe when rocks are first enabled. Switching rocks off cancels pending rocks. All buttons simulate events for free; they do not purchase gifts.

The checkpoint displays route survival based on actual HP and gear, plus the current summit reward. Route odds exclude future gift rocks. The design rationale and balance calculations are in [docs/game-design.md](docs/game-design.md).

## Live Twitch and OBS

1. Register a Twitch application with redirect URL `http://localhost:4177/auth/twitch/callback`.
2. Copy `.env.example` to `.env` if needed, add your Twitch client ID and secret, and restart. Keep existing credentials if `.env` already exists.
3. Open **Setup & OBS**, connect one broadcaster account (a second is optional), then click **Start live mode**.
4. Add `http://localhost:4177/overlay` as an OBS Browser source at **1920 × 1080**. The background is transparent. `/overlay?preview=1` adds a placeholder background for testing.

Only broadcasters sign in to this app. Viewers play in Twitch chat using their existing Twitch account:

| Command | Action |
| --- | --- |
| `!join` | Create or restore your explorer |
| `!dig` | Join the climb queue; also joins the camp if needed |
| `!idea bees` | Submit or replace your idea for the next cave |
| `!keep` | Bank the current climb's loot at the checkpoint |
| `!risk` | Continue through three more dangerous rooms |
| `!equip shield` | Equip an owned Pebble shield: block the first hit |
| `!equip boots` | Equip owned Spring boots: skip gap damage |
| `!equip lamp` | Equip an owned Glow lantern: +2 ore per cleared room |
| `!equip crown` | Wear an owned summit trophy |

The checkpoint waits 45 seconds in live mode, then safely keeps the loot. Falling loses only unbanked loot from that climb. XP and previously owned items remain. Every resolved room earns 15 XP; each 100 XP adds a level. Levels are cosmetic in this version. Ore is a saved score; there is no shop yet.

Twitch Hype Train levels 1–2 grant 2× ore, and level 3+ grants 3×. The bonus applies to that channel's active and queued climbs, and stays for those climbs after the train ends. It does not multiply XP or make a viewer stronger. Hype and gift subscriptions are optional: chat remains usable if Twitch rejects them. Gift rocks default off; enable them in Setup. Reconnect Twitch to grant the new `channel:read:subscriptions` scope, then check that Gift subs says connected. The production event adapter is implemented but has only been tested with mocked Twitch events so far.

## Two channels

Both channels share one server, a queue that alternates camps when both are waiting, and one OBS state. Both sources show both camps and named rescues; viewers can stay with their own streamer. One successful rescue each way earns a cosmetic keepsake for the involved donors and rescued viewers. Disconnecting a partner clears pending ropes and leaves solo climbs available; changing the channel pair also clears shared rescue progress. Each Twitch user keeps one profile even if they join from both channels. A second streamer on another computer needs a shared HTTPS deployment; their localhost URL cannot reach your computer.

For deployment, set `HOST`, `PORT`, `BASE_URL`, and a `CONTROL_TOKEN` of at least 20 characters. Use HTTPS through a reverse proxy, preserve `.runtime`, and register the public OAuth callback URL in Twitch. Remote host controls require the token; OBS URLs never contain credentials. Twitch accounts reconnect after a server restart. This repository has not been deployed as part of the excavation pivot.

## Saved data and limits

- `.runtime/expedition-profiles.json` stores demo and Twitch inventories separately, plus streamer settings. It is excluded from Git.
- Refreshing the browser preserves active climbs. Restarting the server preserves banked items, XP, ore, keepsakes, AI finds, and settings; active climbs, caves, idea pools, queues, ropes, and shared rescue progress end. No unbanked loot is awarded on restart.
- One active or queued climb per viewer, configurable 1–3 simultaneous climbers, a configurable cooldown, and a 100-person queue.
- Up to 1,000 joined viewers per session; the overlay displays up to 32 resting avatars at once to avoid covering the stream.
- Slots, cooldown, side, avatar size, auto-climb on first join, and gift rocks are configurable.
- Bits, regular subscriptions, Channel Points, raids, viewer inventory pages, and threshold-based event triggers are **not implemented**.
- Route damage and outcomes use local game rules and randomness. Optional cave generation uses the existing AI key, usage ledger, and request ceiling. The ceiling counts attempts, including failures; it is not a dollar budget. No chat message or climb automatically calls AI.

## Code and verification

```sh
npm run check
npm test
```

| Location | Responsibility |
| --- | --- |
| `src/expedition.ts` | Authoritative queue, runs, rewards, chat commands, Hype Train and gift-rock rules |
| `src/expedition-caves.ts` | Idea selection, validated AI cave generation, fixed route rules, retry/reset isolation |
| `src/ai.ts` | Structured Responses API requests and persistent request/token accounting |
| `src/expedition-rescue.ts` | Rope capacity, travel, rescue records, and shared keepsakes |
| `src/expedition-risk.ts` | Exact route survival and summit reward calculation |
| `src/expedition-events.ts` | Gift event types and bounded rock rules |
| `src/expedition-store.ts` | Atomic profile/settings save and recovery errors |
| `src/expedition-catalog.ts` | Gear, progression, settings validation |
| `src/twitch.ts` | OAuth, chat, Hype Train/gift EventSub, reconnects |
| `server.ts` | HTTP authentication, actions, state, SSE, static files |
| `public/expedition-host.js` | Demo controls and selected viewer |
| `public/expedition-cave-ui.js` | Editable sample ideas, generation status, credits and cave play controls |
| `public/expedition-cave-art.js` | Safe pixel-grid rendering and saved find cards |
| `public/expedition-rescue-ui.js` | Plain rescue status, supply cart, and named rescue effects |
| `public/expedition-event-controls.js` | Simulated Hype/gift controls |
| `public/expedition-event-effects.js` | Shared gift warnings and rock visuals |
| `public/expedition-setup.js` | Twitch/OBS/settings UI |
| `public/expedition-board.js` | Shared host/overlay renderer |
| `public/expedition-board.css` | Game and overlay styling |
| `public/excavation.css` | Host interface styling |

Older doodle-battle files and their regression tests remain as historical work. The main page and `/overlay` now load only the excavation modules; the old paid generation routes are inactive.

The private repository is [aaronkchsu/scrawl](https://github.com/aaronkchsu/scrawl). Do not publish it without an explicit request. See `docs/build-log.md` for actual testing evidence and `docs/PLAN.md` for remaining work.
