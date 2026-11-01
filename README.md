# SCRAWL · Excavation

A small Twitch adventure. Viewers join as explorers, climb for loot, and choose whether to keep it or risk the summit. Linked communities send rescue ropes to each other. Both camps appear on each stream.

**Hosted pilot:** [Open SCRAWL](https://scrawl-zcc6.onrender.com). Twitch sign-in, real chat commands, OBS rendering and saved loot have been verified with one channel. Two-channel live rescue testing remains outstanding. Practice uses simulated viewers and no paid AI.

## Try it locally

Use Node 24, then:

```sh
npm ci
npm run dev:hosted
```

Open **http://localhost:4177** and click **Try a climb**. This previews the hosted interface with embedded Postgres. Practice is simulated and AI requests are disabled. It does not require Twitch or an API key.

## Stream it

On the hosted app: **Sign in with Twitch → Copy OBS URL → Open camp**. Add the URL as an OBS Browser source at 1920 × 1080. Each streamer gets a separate camp and a stable read-only overlay link.

Viewers use their existing Twitch chat account:

| Command | Action |
| --- | --- |
| `!join` | Get an explorer |
| `!dig` | Enter the climb queue |
| `!keep` | Save this climb’s loot |
| `!risk` | Try the summit |
| `!equip shield` | Equip an owned item (also boots, lamp, crown) |
| `!idea bees` | Suggest an idea for an optional AI cave |

A live choice waits 45 seconds, then safely keeps loot. Earlier items and XP survive a fall. One viewer can have one active or queued climb per room. A room supports 1–3 climbers and a 100-person queue.

**Invite another streamer** in setup to share a camp. Invitations last 24 hours and work once. Link or unlink between climbs. Queued players and banked loot stay with their camps. Both streamers agree to the displayed climber count and pace; each keeps their own event settings.

Hype Train levels 1–2 give 2× ore; level 3+ gives 3×. Optional gift-sub rocks default off and use a warning, bounded damage and cooldown. Choosing Keep can send a partner rescue rope. These events have different visuals; none automatically calls AI. See [game rules](docs/game-design.md).

## Host on Render

[Deployment instructions](docs/hosting.md) cover the private repository, Render Blueprint, Twitch callback and launch checks. `render.yaml` creates one paid Node container and managed Postgres. Actual deployment status and tested limits are in [build history](docs/build-log.md).

Normal caves and practice are free of AI charges. Only the operator can enable AI for a streamer. Creating or retrying a cave requires an explicit click and reserves one request before calling the API. The initial hosted ledger preserves 13 prior attempts against the existing 14-request cap. The request cap is not a dollar billing cap.

## Verify

```sh
npm run check
npm test
```

Tests mock Twitch and AI. They cover room isolation, OAuth, invitations, save rollback, restart recovery, simultaneous rewards, lease handoff and 10 rooms with 100 viewers each. They do not replace the final two-account Twitch/OBS playtest.

## Code

- `src/hosted-server.ts`: sessions, HTTP/SSE, Twitch connections and explicit AI jobs.
- `src/hosted-game.ts`: room ownership, pairing and isolated game actions.
- `src/hosted-store.ts`: Postgres transactions, deduplication and the single-server lease.
- `src/expedition*.ts`: game rules, queue, loot, events, rescue and cave generation.
- `public/expedition*.js`: onboarding, camp controls and shared OBS rendering.

`npm run dev` retains the single-host local mode; its separate instructions are in [local development](docs/local-development.md). Hosted mode is selected by `DATABASE_URL`. Captions is a separate project. Historical doodle-battle modules remain in source but are not the current game.

Keep this repository private until the owner explicitly requests publication. Credentials, dependencies and local runtime data are excluded from Git.
