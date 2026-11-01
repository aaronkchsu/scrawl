# Excavation implementation status

The excavation game replaces the boss race as SCRAWL's active experience. It is designed to sit beside normal streaming rather than take over the screen.

## Implemented

- Four original monochrome pixel explorers, small bottom-edge avatars, narrow left/right climb lane. Stable identity selects each viewer's silhouette across the profile and overlay.
- One to three simultaneous climbers; one queue entry per viewer; configurable cooldown.
- Procedural six-room climbs, crates/enemies/gaps, health, animated ascent and obstacle clears.
- One keep-or-risk decision. Demo holds indefinitely; live safely banks after 45 seconds.
- Persistent ore, XP, levels, gear ownership, equipment, and settings. Gear changes future climbs.
- Two named camps across two broadcaster accounts; identified viewers from chat; starts alternate camps when both have a queue.
- Twitch chat, Hype Train v2, and gift-sub v1 adapters, plus explicitly simulated local controls.
- Hype levels 1–2 give 2× ore; level 3+ gives 3×, scoped to the originating channel.
- Optional gift rocks on new upper climbs: 8s warning, 35% chance of 1 HP damage, one opportunity per climb and a 30s channel cooldown. Shields block; gift batches do not stack damage.
- Keep/Risk shows actual route survival odds for the current HP and gear. See [design research and playtest plan](game-design.md).
- Keep sends a capped rescue rope to the partner camp. Fatal route damage and gift rocks can consume it, saving existing loot without a summit win. Hype adds a fixed five ore to supplies.
- One rescue each way earns an involved viewer a persistent Linked Lantern keepsake recording both camps and contributors.
- Four-choice scripted rescue practice with automatic viewer selection, held decisions, and one primary action at a time.
- Matching host and read-only OBS state, reconnect indication, saved-data errors and retry.
- Host-triggered AI caves: three to six chat ideas become a theme, original enemy/collectible pixel art, and one fixed route rule. Each camp creates the other’s cave, with contributor credits on both overlays. Solo channels create their own.
- Persistent cosmetic AI finds, editable demo ideas, explicit paid requests, capped usage, locked retries, and reset/late-result isolation.
- Monochrome host interface based on the user's skills.sh reference; original block wordmark.

## Hosted implementation

- Twitch identity owns each camp; secure sessions replace the shared host password. Read-only OBS URLs stay stable when pairing.
- Isolated one/two-channel rooms, one-use 24-hour invitations, fixed shared rules and separate event settings.
- Encrypted credentials, transactional loot, event deduplication, queues, active climbs and usage in Postgres. A database lease allows one coordinator and hands over on deployment.
- Startup/hourly token validation, refresh/reconnect/re-subscribe, visible chat/Hype/gift availability.
- Free per-session practice; built-in caves for all; operator-controlled explicit AI requests with the prior 13/14 ledger preserved.
- Render Docker + Postgres Blueprint and Node 24 CI.

## Needed before a live release

- Connect a real broadcaster and verify OAuth, chat, Hype Train and gift-sub access, and reconnect behavior. Automated tests use mocks.
- Test in OBS and a second streamer's browser source. Browser rendering and transparency are checked, but OBS itself has not been exercised.
- Deploy the prepared Render Blueprint with managed Postgres; finish Twitch application registration and the hosted smoke test.
- Local automated checks cover 10 rooms with 100 viewers each. Check actual hosted latency and tune queue wait times; currently 32 resting avatars are rendered.
- Capture a real-stream promotional demo; label any simulated events in the recording.

## Later ideas, not shipped

- Streamer-configurable Bits/subscription/Channel Points thresholds and raid triggers.
- Larger multi-channel expeditions and a collection museum.
- Viewer inventory/equipment page, more character variation and item art.
- More route types and choices after audience testing; learning audience preferences is not implemented.

## Scope limits

XP levels are cosmetic. Ore has no spending system. Equipment is a small fixed catalog; AI finds are cosmetic. Two channels share a queue and trade rescues; there is no competitive scoring system. Hosted mode checkpoints climbs and pauses hazards during downtime. The legacy local server still ends unfinished climbs on restart. No Blerpy images are used.
