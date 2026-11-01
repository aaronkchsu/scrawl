# Actual build evidence

## October 27, 2026 — first local implementation

- Inspected workspace and confirmed the captions project is a separate sibling. Created this repository directory without reading or modifying its credentials.
- Built one Node 24 TypeScript coordinator and browser-native dashboard/OBS views. No runtime npm dependencies; TypeScript and Node types are development-only dependencies.
- Designed original code-native notebook artwork: one-eyed ink monster, duck, robot, cat, frog and modular equipment. This is authored demo art, not an AI image-generation result.
- Implemented contributor balancing, fixed scoring, paired invention effects, server-authoritative timed phases and full-state SSE snapshots.
- Implemented optional OAuth/EventSub and original vector-output AI adapters. At initial implementation no credentials were present. The later live AI verification is recorded below; Twitch authorization has not been performed.
- Testing exposed an HTTP-test origin/Host mismatch caused by the test's ephemeral listener setup. Corrected the test to use the server's actual configured origin, preserving the application origin checks.
- Capped stored ideas per author before the global message buffer so a prolific author cannot evict everyone else.
- Browser QA ran a full scripted encounter and inspected both opposite community perspectives. No browser warnings/errors were reported in that run.
- Browser rehearsal after a development-server restart exposed an expired host session. Added a one-time local session refresh; remote hosts still need their control token.
- Visual QA found the original overlay layout exceeded a 16:9 browser viewport. Reworked it to fit the broadcast frame and retain contribution labels. Idle OBS views hide until an encounter starts.

Final verification: TypeScript checking and browser JavaScript syntax checks passed; all 17 automated tests passed. Browser rehearsal verified six manually entered contributor names shaping two inventions, both overlay perspectives, and successful encounter restart without reloading after the server restarted. Saved dashboard and overlay PNGs in artifacts/. This log is intentionally limited to work actually performed, not a generated retrospective about hypothetical iterations.

## Remaining evidence gaps

Real Twitch messages, two simultaneous streams, repeated live-AI quality/latency under load, exact billed cost for interrupted requests, hosted operation, audience fairness at different sizes, and playtest enjoyment remain unverified. Fixture replay cannot establish these results.

## October 27, 2026 — real AI verification

- User supplied the OpenAI key in this project's private, ignored `.env`. No key was printed, sent to the browser, or stored in evidence.
- First two paid attempts exposed a mismatch: the structured schema allowed more invention features than our validator accepted. Added matching shape, array, numeric, and string limits. The other in-flight request was aborted when validation failed.
- A development watch restart interrupted the next two calls. Switched to a stable `npm start` process for paid verification. All four attempts remained counted.
- Added an atomic, private local usage ledger so the request ceiling, reported tokens, and missing-usage count survive restarts. Added regression coverage for a successful call followed by an interrupted call and a restart at the ceiling.
- Two final calls succeeded: six manual messages became a 31-shape snail with sponge tail and wheel, and a 29-shape jellyfish with boots, jar, and umbrella. Each credited all three actual contributors. Generation took 23.4 and 26.8 seconds, with the shared reveal ready in 27.2 seconds. Saved the actual output and state to `artifacts/live-ai-first-pass.json`; the game was paused at the reveal for inspection.
- Six attempts total; usage returned for three: 2,107 input and 6,052 output tokens. Approximate reported cost $0.064734 at $2/M input and $10/M output. Three interrupted calls may add charges. About $0.30 is a conservative test allowance under standard pricing, not a verified invoice. The cap remains exhausted at six attempts.
- Enabled animation on the generated body layer and made the overlay credit area adapt when feature descriptions wrap.

Validation: TypeScript and all 18 automated tests pass. Live evidence uses manually entered ideas, not real Twitch chat. The boss artwork and fixed combat rules remain authored. No hosting was purchased or deployed.

## Manual testing handoff

User asked how to test. Raised the local cumulative request ceiling from six to 14 (eight additional requests, enough for two full two-round matches), retained all usage counters, and restarted the stable server into the lobby. No additional paid generations were run during this handoff.

## Shared boss, one vote, and a collective finisher

The user asked for an Astra review, then accepted its recommendation to keep the shared boss and defer sabotage. An actual `gpt-6-astra` subagent reviewed the design. Its concerns were too many voting gates, duplicated boss encounters, unproven sabotage balance, and overstating audience fairness.

Implemented:

- One valid nomination per viewer per round; explicit Twitch `!idea counter invention` commands, with ordinary conversation excluded. Decline normalized exact duplicate ideas across viewers.
- Uniform reservoir of at most 12 unique nominees, then up to three sampled finalists per team. Sparse chats show fewer actual finalists, with no invented filler.
- One 12-second vote: one active vote per viewer, changes move rather than add influence, duplicate votes do nothing. Random tie/no-vote resolution is disclosed.
- The winner sets the lead invention and published counter. The other finalists contribute compatible visual details; AI validation requires credits for every provided finalist and the selected counter. Combat reads the declared counter, never AI-assigned extra powers.
- Both overlays show both ballots and retain the locked recipe during slow/failed drawing. Only one generation per nonempty community per round; no nomination/vote interpretation calls.
- Shared victory and a five-second finishing move using both existing drawings, with both community names, creation names, and actual contributor credits. No extra AI call for the finisher.
- Corrected the authored grounding equipment to a conductive wire to earth; insulating boots are not labeled grounding. Braces require a valid nomination and use its participation ratio.

Verification:

- TypeScript, browser JS syntax, and all 28 tests passed. Added meaningful coverage for sampling late arrivals, spam, vote changes, no-vote ties, sparse ballots, preserving a selected recipe on retry, a 500-versus-3 mechanical-power comparison, and no generation during nomination/voting or the shared finisher. HTTP/SSE tests cover the host-controlled voting route and actual snapshots.
- Browser QA manually entered six nominations, voted on both teams, repeated a vote, inspected both ballots in one overlay, and inspected the offline finisher.
- A full real-AI match used six manually simulated authors and 3 versus 30 simulated voters. Both teams earned 82 impact, all four drawings credited three finalists, both inventions appeared in the finisher, and the server reached shared victory. Round generation took 26.6 and 28.0 seconds. This was not real Twitch participation.
- Four additional API requests reported 3,145 input and 8,779 output tokens: approximately $0.09408 at the documented standard rates. Cumulative known token estimate is $0.158814, plus the same three earlier interrupted requests whose usage was unavailable. The cumulative cap remains 14, with ten attempts used and four remaining.
- Saved actual round/final snapshots, voting screenshot, offline finisher, and live-AI finisher under `artifacts/`. No hosted deployment or actual two-stream playtest has occurred.

Remaining limits: the published counter vocabulary is deliberately small; strategic balance and fun need playtesting. Equal budgets do not remove the larger community’s advantage in idea discovery. Inspected both perspectives and a 1280×720 (16:9) preview, including 280-character nominations. The long-text check exposed a footer overlap; capped overlay descriptions at two lines, tightened short-viewport spacing, and retained full text in the host view. Rechecked that all six cards, counters, vote commands, and credits fit. Actual 1920×1080 OBS sources and real streams still need testing.

Handoff: reset the local server to the lobby after paid and offline QA, with all ten attempts retained and four available. The dashboard is ready for a new manual test; saved victory and finisher images preserve the actual completed live-AI match.


## October 27, 2026 — guided launcher and rehearsal

Replaced the mixed dashboard with Watch a demo, Rehearse an encounter, and Set up Twitch. Split launcher, rehearsal, setup, and shared UI helpers into browser modules. Added explicit server experience state, whole-form rehearsal nomination validation, stable simulated voting, and held editing/voting/reveal phases. Live sessions reject simulated sources and the old manual HTTP entry point; Twitch input cannot affect rehearsals. Paid rehearsal drawing checks capacity for both communities before starting. No request cap increase.

Verification: 34 Node tests, TypeScript check, and browser-module syntax checks. Browser rehearsal edited both communities, persisted text through reload, accepted keyboard voting, held the reveal through reload, advanced into a held second-round editor, and completed the shared victory using free artwork. Layouts inspected at 1280px, 742px, and 390px; the 390px document width matched its viewport. The refreshed overlay showed matching boss health and explicit simulated-participant labels. Evidence: artifacts/rehearsal-voting-desktop.png and artifacts/rehearsal-mobile.png. AI provider behavior was mocked in tests; no new paid AI request was made during this work.

The launcher’s one-click scripted demo was also played to shared victory in the browser. No console errors appeared during the rehearsal and demo runs. The updated launcher screenshot is artifacts/scrawl-simple-launcher.png.

## October 28, 2026 — plain language and clearer steps

Replaced theatrical launcher, test, setup, board, overlay, and result copy with short action labels. The manual test now shows Ideas → Pick → Draw → Fight, with the current round visible while editing. Automatic demos do not show a host task checklist or simulated Twitch vote commands. Read-only test overlays say they are waiting for the host; the host sees Start fight. Removed repeated instructions and kept paid-call labels next to drawing actions. Updated the README to match the buttons.

Fixed sample artwork descriptions retaining the majority animal after the vote chose another animal. Descriptions now use the final body and equipment, including the selected attack tool. Added a regression test for two duck ideas losing to a frog with a bucket. Default team names now match the Orange/Blue editor labels.

Verification: TypeScript, all 35 Node tests, browser JavaScript syntax, and git whitespace checks passed. Browser QA completed a free two-round manual test and the automatic demo, checked edits surviving refresh and keyboard voting, and confirmed matching host/overlay state. Inspected 1280px desktop, 865px in-app, and 390px mobile layouts; mobile document width was 390px with no horizontal overflow. No browser warnings/errors were reported. Saved artifacts/plain-copy-home.png and artifacts/plain-copy-fight-ready.png. No paid AI calls or hosting charges; the ledger remains at 10 of 14 attempted requests. Left the server running and the app at home. These changes are local; this pass did not update the GitHub copy.

## October 28, 2026 — separate bosses and competitive results

Changed the game at the user's request: each community fights its own 70-health boss, and both fights appear on either stream. Each overlay puts its own community first and displays its own win/loss result. Both attacks resolve before choosing the winner, so generation speed cannot determine victory. First boss defeated wins; same-round defeats draw. At the two-round limit, more boss damage wins, with equal damage drawing. Removed the shared damage bonus and combined finisher. Fighter health is feedback, not a winner tiebreaker; the small counter vocabulary still needs competitive playtesting.

Split battle drawing and race presentation into browser modules and race outcome rules into a server module. Added independent boss meters, per-fight damage, defeated-boss animation, result labels, visible rules, and mobile fight labels. The host board stacks fights on narrow screens; broadcast overlays retain both fights side by side. The free demo deliberately chooses different attacks to demonstrate Orange winning and Blue losing. AI choice labels now show the remaining call allowance.

Verification: TypeScript, browser JavaScript syntax, git whitespace checks, and all 42 Node tests passed. New tests cover independent damage, either team's victory, same-round draws, round-limit results, slow generation, and reset. HTTP/SSE snapshots include both bosses. Browser QA completed the free demo and a two-round manual rehearsal, verified both overlay perspectives for win/loss and a matching host/overlay draw, and inspected 1280×720 and 1920×1080 overlays plus a 390px host layout. Saved artifacts/competitive-blue-loss-720.png, competitive-blue-loss-1920.png, competitive-mobile.png, and competitive-draw.png. No paid AI calls or hosting charges during this change: the ledger stayed at 12 of 14 attempts (two calls had been used in the user's preceding test). Backed up that earlier test's state and draft fields under ignored .runtime before restarting. No real Twitch streams were connected, and no GitHub push was performed.

## October 30, 2026 — excavation game and monochrome restyle

Replaced the active boss app with the user's excavation direction. Original explorers idle at the bottom of the stream, and up to three climb on foot in a narrow side shaft. A one-entry-per-viewer queue starts them with a stagger. Each climb clears three rooms, waits for Keep loot or Risk it, then either banks the reward or attempts three danger rooms for a summit crown. Banked items, ore, XP, and streamer settings persist in an atomic local save. Gear has explicit effects, and equipment is locked at the start of a climb. Demo checkpoint choices wait indefinitely; live choices safely bank after 45 seconds.

Added channel-scoped 2×/3× Hype Train bonuses, duplicate-event handling, Twitch chat commands, optional second-channel support, and configurable slots, cooldown, avatar size, side, and automatic first climb. Twitch adapters subscribe to chat v1 and Hype Train v2. Live identities cannot be created by simulated host controls. State, actions, and read-only overlays retain server authentication and origin checks. Routes are assembled locally with randomized encounters; this version makes no AI generation calls. Historical boss modules remain inactive for reference.

The user then supplied a skills.sh screenshot and requested a less generic appearance. Rebuilt the host interface with black and white, an original block-letter wordmark, thin dividers, plain instructions, and simple controls. Kept color in the original explorer, loot, and Hype feedback. Reused the project's previously generated original explorer asset; no Blerpy art was included or traced. Split host, setup, connection, shared board, game rules, catalog, and persistence into separate modules. Updated README, plan, storyboard, and contributor instructions around the implemented product.

Verification: TypeScript, browser JavaScript syntax, git whitespace checks, and all 52 Node tests passed. New checks cover queue fairness and stagger, held choices, save/restart, failed-save retry, corruption protection, equipment effects, risk loss, Hype deduplication and channel isolation, live/demo separation, stale sessions, HTTP/SSE snapshots, and disconnects during pending Twitch subscriptions. Generation remains mocked in historical tests.

Browser playtesting exercised Keep and Risk, banked inventory, three simultaneous climbs with a fourth queued, refresh persistence, keyboard activation, settings, and matching overlay state. Inspected the final desktop host and setup, a 390px host with no horizontal overflow, and a 1920×1080 overlay with three held climbers. Final fixed-size checks used isolated same-origin frames because the browser viewport override did not change the inspected tab's dimensions. Confirmed transparent overlay HTML/body, hidden preview backdrop, and no interactive controls. Browser warnings/errors were empty. Saved artifacts/excavation-desktop.png, excavation-mobile.png, and excavation-overlay-1920.png; removed the temporary layout-review harness.

No new paid AI calls or hosting charges were incurred ($0 incremental API spend). Existing AI keys, usage history, and cap were not changed. Real Twitch channels, actual OBS capture, hosted multi-computer play, and audience enjoyment still need testing. The new game is running locally and remains unpushed: terminal Git authentication is unavailable, and the connector could not access the private repository. No repository visibility was changed, and the captions application was untouched.

## October 30, 2026 — matching explorer mascots

Replaced the active colored explorer with four original monochrome pixel-style miners to match the new interface. Generated a transparent atlas with the built-in image tool, then refined it to simplify detail for small avatars. No Blerpy image was used as an asset or generation reference. Exact prompts and provenance are saved under public/assets. The final downloaded PNG is unchanged; nested SVG viewports isolate each sprite and prevent adjacent atlas content from leaking into the fitted portrait's padding.

A shared browser module selects a stable silhouette from the viewer ID and renders it in the camp, climb, and profile. Kept existing equipped-gear badges, updated movement to stepped bobbing, and made the small enemy silhouettes more angular. No game rules, server data, saved progress, or request caps changed.

Verification: browser JavaScript syntax and git whitespace checks passed. Inspected all four sprites at 44px and 72px on light and dark backgrounds, the host profile switch, and the matching 1920×1080 overlay with three held climbers. The review caught and fixed neighboring atlas content appearing beside narrow sprites. The final host reported no browser warnings/errors. Saved artifacts/mascot-size-check.png, excavation-mono-overlay.png, and excavation-mono-mascots.png; removed the temporary review files. This visual-only pass did not rerun the server tests. Kept the user's pending climb choices intact.

Used two built-in image generations. No calls used the project's API key; the built-in tool does not report a dollar cost, so its cost is not represented as zero. Changes remain local and unpushed.


## October 30, 2026 — risk balance and distinct Twitch events

Researched primary material from Marbles on Stream, Sea of Thieves, Into the Breach, and Twitch EventSub. Saved source links, decision-theory calculations, design inferences, missing systems, and a small audience playtest plan in docs/game-design.md. The research supports hypotheses, not a claim that the game is proven fun.

Reduced upper-room hit probability from 55% to 35% as an initial balance adjustment. Keep/Risk now shows current health, available loot, summit reward, and exact route survival probability calculated from HP, remaining rooms, and equipped shield/boots. Future gift rocks are explicitly excluded from those odds. Hype has a sustained gold shaft, large multiplier, and boosted ore feedback.

Added optional gift-sub rocks with separate simulated controls. Streamer opt-in applies to new climbs; only viewers who subsequently choose Risk can be targeted. A random eligible climber in the gifting channel receives an eight-second warning, then one 35% chance of losing 1 HP. An unused shield blocks it. Room progress pauses during the warning and resumes afterward. One opportunity per climb and a 30-second channel cooldown prevent stacking. Batch count affects decoration only. Lower rooms and Keep remain protected, and previous loot and XP survive loss. Disabling, disconnecting, or resetting cancels pending rocks.

Added channel.subscription.gift v1 and channel:read:subscriptions to the Twitch adapter. Preserves anonymous gifts, deduplicates deliveries, rejects stale events, isolates channels/demo/live, handles gift permission failures independently of chat, and restores capability indicators after socket transfer. Real Twitch delivery remains unverified. Regular subscriptions, Bits, raids, and Channel Points remain unimplemented.

Verification: all 61 tests passed. After adding settings-persistence and legacy-save coverage, reran the 22 affected expedition, HTTP, and Twitch tests successfully, plus TypeScript, browser-module syntax, and git whitespace checks. Meaningful cases include exact route odds, rock warning timing, hit/miss/shield/fatal outcomes, one-rock limits, batches, duplicate delivery, reset, stale requests, cancel/off-on behavior, persisted opt-in, channel isolation, OAuth scopes, permission failures, and socket transfer. All generation in historical tests remained mocked.

Browser QA used keyboard Start/Risk, simulated 2×/3× Hype, and one- and ten-gift tests. Observed one hit followed by a later route death and another hit followed by a successful summit with 124 banked ore, shield, and crown. Fixed stale gift feedback and moved event controls below the main decision on narrow layouts. Inspected the 885px host and fixed-size 390px host/1920×1080 overlay frames. Mobile document width matched 390px; overlay width matched 1920px, body background was transparent, and it contained no interactive controls. Host/overlay climber text, HP, and loot matched. The active host reported no console warnings/errors. The temporary review harness recorded one MutationObserver error with no source URL; its frame measurements and rendered content still completed, and it was removed after inspection. Saved artifacts/excavation-gift-warning.png and artifacts/excavation-events-mobile.png. Actual OBS capture and audience enjoyment have not been tested.

Incremental project AI API spend: $0. No paid generation, subscriptions, or hosting purchases. Existing AI cap and credentials unchanged; captions untouched. Changes remain local and unpushed; no GitHub visibility change. The server remains running on localhost:4177 in demo mode with gift rocks enabled for the next test.


## October 30–31, 2026 — cross-community rescues and four-choice practice

Implemented a reciprocal rescue line between two camps. Explicit Keep banks the viewer's loot and sends one rope when the line is ready. After three seconds, it can catch the partner camp's next fatal fall and bring that viewer home with existing loot. It also handles fatal gift-rock hits. A catch does not clear the failed room or earn a summit crown. Each direction has one-rope capacity and a 60-second sending cooldown; Hype adds a fixed five ore to the eventual rescue. Automatic timeout Keep does not send help. Disconnected partners cannot send or retain pending ropes; solo climbs still work.

Both overlays show named camps, travelling supplies, caught falls, and saved loot. One rescue each direction awards the involved donors/recipients a persistent Linked Lantern cosmetic containing both camp names and participants. The queue alternates camps when both have viewers waiting, retaining arrival order within each camp. This limits crowding rather than claiming complete audience-size fairness.

Added Try a rescue: four explicitly scripted choices, Keep → Risk → Keep → Risk. It automatically selects Noodle and Mossboss, starts at a held checkpoint, uses a fixed fall, and shows just the needed primary action. The guide survives browser refresh, and Back to playground returns to ordinary random routes. Longer rules, camp logs, event tests, and keepsake records are expandable. Mobile controls follow the board in both visual and keyboard order.

Verification: TypeScript and all 71 Node tests passed. New coverage checks rope travel/capacity/recharge, repeat commands and awards, self-rescue rejection, locked originating camp, fixed Hype supplies, fatal gift rescue, summit crown exclusion, one-slot practice, held choices, saved cosmetics and corrupt nested saves, disconnect/reconnect/new partners, timeout behavior, stale actions/reset, alternating camp queue order, and immutable snapshots. HTTP tests check authentication, demo-only practice, blocked event injection during practice, and matching HTTP/SSE state. Historical generation is mocked. After the final copy/layout edits, browser-module syntax and git whitespace checks passed.

Browser QA completed all four practice actions with keyboard Enter, reloaded at a held choice, confirmed automatic viewer changes, and opened the earned keepsake showing Camp A + Camp B and Noodle + Mossboss. Replayed the first rescue to capture its named overlay moment. Inspected the 1047px desktop host, a 390px host frame (document width also 390px), and a 1920×1080 overlay frame with both camp names and scripted labels. Computed HTML/body overlay backgrounds were transparent; actual OBS compositing remains untested. The active host returned no console warnings or errors. Temporary layout-check files and tab were removed.

Evidence: artifacts/excavation-rescue-moment.png (caught fall), artifacts/excavation-rescue-desktop.png (shared keepsake), artifacts/excavation-rescue-mobile.png (390px controls), and artifacts/excavation-rescue-ready.png (final playground). The server is running on localhost:4177 in normal demo mode, ready for Try a rescue. Saved demo loot and existing settings remain.

Real Twitch channels were not connected during this work, so live delivery, remote hosting, actual OBS capture, and audience enjoyment still need validation. No new AI API requests or paid services: incremental project API spend $0. No repository visibility change, commit, or push; captions unchanged.

## October 31, 2026 — chat-created AI caves and collectible finds

Implemented explicit AI cave creation from three to six distinct viewer ideas. In linked camps, each community builds the other camp's cave; a solo camp builds its own. One idea per viewer, normalized duplicate collapse, a 200-idea pool cap, and a random sample of at most six bound the input. Successful generation consumes the used ideas while preserving newer edits. These limits reduce spam but do not establish complete audience-size fairness.

The model produces an original theme, a 16×16 enemy sprite, a 16×16 collectible sprite, contributor credits, and one of three predefined route rules. Strict validation prevents arbitrary stats or executable artwork. The existing combat odds, gear effects, and Keep/Risk rules remain authoritative. Each climb locks its cave at departure; banking from the checkpoint saves the cosmetic find and credits in the viewer's persistent inventory. This uses a pretrained generative model, not a model trained on viewers or an adaptive difficulty system. Whether the feature improves enjoyment still requires audience testing.

Added a small host workshop with three editable simulated ideas, saved browser drafts, an explicit paid Create cave button, a free Try cave button, and expandable credits. Live viewers can submit !idea through the existing authenticated Twitch chat path. Host generation is explicit; normal climbs never call AI. Retrying preserves the failed recipe. Reset aborts pending work and discards late results. Request limits, disconnected controls, and generation errors have visible recovery paths. Shared board rendering carries the theme, sprites, and credits into the overlay.

Verification: TypeScript, browser JavaScript syntax, git whitespace checks, and all 84 Node tests passed. New coverage includes validated structured output, anonymous idea payloads, selection and spam limits, idea consumption, generation/reset races, locked retries, request caps, authentication, live/demo isolation, cooldown eligibility, route snapshots, one-time find awards, save/restart, and matching HTTP/SSE state. Automated generation checks use mocks.

Browser QA generated the real Frost Hive cave from bees, frozen honey, and a broken toaster. Confirmed Busted Buzzbox enemy art, Honey Ice Toast collectible art, all three contributor credits, editable drafts surviving refresh, free replay, keyboard controls, held Keep/Risk choices, collectible award, and persisted finds after restarting the server. Fixed Try cave selecting a resting viewer and added local action-error feedback. An isolated mock server tested a 503 error, retrying the saved ideas after changing the editor, exhausted request allowance, and disabled controls after disconnect. It used no external requests or persistent player data and was stopped afterward.

Inspected the 1280px desktop host, 390px mobile host without horizontal overflow, and 1920×1080 transparent overlay with matching cave, contributors, health, and loot. The overlay contains no interactive controls; host console warnings/errors were empty. Evidence: artifacts/excavation-ai-cave-desktop.png, excavation-ai-cave-mobile.png, and excavation-ai-cave-overlay.png. Actual OBS capture and real Twitch delivery remain untested.

Exactly one real project API request was made during this change. The ledger advanced from 12 to 13 attempts of the unchanged 14-request cap. Reported incremental usage was 445 input tokens and 1,114 output tokens on gpt-6.1-sol: approximately $0.01203 at the published standard $2/$10 per million input/output token rates (https://developers.openai.com/api/docs/models/gpt-6.1-sol). This is a token-based estimate, not an invoice; three historical attempts lack reported usage. No hosting purchase or image API call was made. One request remains. Replays are free.

The server remains running locally on port 4177 with the real generated cave available. During development restart, restored that cave from an ignored runtime backup so it could be tried without another paid request; ordinary server restarts reset prepared caves, while collected finds persist. Changes remain local and unpushed. No repository visibility change; captions untouched.


## November 1, 2026 — hosted Twitch app implementation

Implemented Twitch-owned camps, secure server sessions, isolated room snapshots/actions/SSE, stable read-only OBS URLs, optional two-streamer invitations and per-channel event settings. Credentials use authenticated encryption. Postgres transactions save room checkpoints, inventories, sessions, deduplication records and the request ledger together. Incremental room/profile writes avoid rewriting all inventories on idle ticks. A renewable single-coordinator database lease drains the old process during an overlapping deployment. Interrupted climbs shift deadlines instead of advancing hazards during downtime.

Twitch connections validate identity at startup/hourly, refresh credentials, retry transient failures and recreate subscriptions after disconnects. Hype and gift permission availability is independent of chat. Built-in caves need no AI. Paid generation is operator-enabled per streamer, explicit, request-reserved atomically and capped at the existing 14 attempts (13 historical attempts imported). Reset/session changes discard stale completions; retry retains the chosen recipe.

Added the hosted streamer setup, private per-session practice, viewer commands/queue hints, unavailable-event notices, save interruption handling and reload recovery. Added Docker/Render Blueprint, managed Postgres configuration, Node 24 CI, setup documentation and an embedded-Postgres local preview. The captions project was not modified.

Verification: TypeScript and all 98 automated tests passed; generation and Twitch were mocked. Coverage includes OAuth cookie binding, one-use state, session rotation, room forgery/third-camp isolation, expired invitations, queue-preserving pairing/unlinking, restart timing, concurrent rewards, duplicate events, transaction rollback, lease handoff, token refresh/reconnect and request-cap races. Local load checks covered 10 rooms with 100 viewers each, including a persistent Postgres-compatible test restoring 1,000 viewer profiles; an idle tick wrote no profile/room entities. These are local tests, not a production-network benchmark.

Browser checks exercised keyboard Keep/Risk and cross-community rescue practice, a held choice surviving refresh, separate hosted setup, a 390px camp with no horizontal overflow, and a 1920px read-only overlay with transparent background and no interactive controls. Browser viewport overrides did not affect the tab, so fixed-size same-origin frames were used. Anonymous practice expires after one hour; reloading then creates a new practice session. Real Twitch accounts, actual OBS compositing and a real login/rescue recording still require the deployed app and broadcaster authorization.

The hosted source, artwork, tests, preview launcher and visual evidence were saved to private aaronkchsu/scrawl through the authenticated browser; no Git history was rewritten. GitHub reports an account billing lock, so Actions jobs cannot execute. The Docker build now runs TypeScript and mocked tests before producing the production image, independent of GitHub Actions. That container build still requires Render verification; Docker is unavailable locally. Render recognizes the Blueprint but requires a payment method before creating the paid services. No hosting resources have been created at this checkpoint. Twitch console has no registered app yet. No new paid AI requests: incremental project API cost $0. Hosting cost remains $0 at this checkpoint.

## November 1, 2026 — first hosted deployment

Deployed the private repository to https://scrawl-zcc6.onrender.com with one paid Render Node service and managed Postgres. The first deployment of 4299ceb passed the Docker TypeScript/test gate: 98 tests passed, none failed. Render reported Live. HTTPS health returned 200, hosted configuration returned hosted=true, and an unauthenticated state request correctly returned 401.

Browser practice reached the held Keep/Risk choice, survived a refresh, and Keep banked 15 ore, Spring boots and 45 XP. Another refresh retained that session's inventory. A subsequent deployment displayed the server-interrupted state and Reload recovered the anonymous practice; anonymous practice is process-local and resets on deployment. Authenticated progress is stored in Postgres, but real-account deployment recovery still needs a live test.

Completed all four hosted rescue-practice choices. The interface reached 2/2 rescues and awarded the Linked Lantern; Noodle and Mossboss each banked 30 ore. The separate overlay matched the current climber, HP and bag, then returned to the bottom avatar row. Its HTML/body backgrounds were transparent and it contained zero form controls. The hosted dashboard reported no console warnings or errors. This was scripted practice, not real Twitch delivery or OBS capture.

Verified Render's recurring estimate at creation: $7 web service + $6 database + $1.50 for 5GB storage = $14.50/month, prorated. Hosting is now accruing; this is an estimate, not an invoice or a provider spending cap. Added that estimate to the Blueprint for the app's budget display. No new AI requests were made and hosted AI remains disabled. The existing $100 budget and 14-request cap remain unchanged.

Registered SCRAWL Excavation under AaronKc in Twitch Developer with the production callback https://scrawl-zcc6.onrender.com/auth/twitch/callback. Credentials and broadcaster authorization are still pending at this checkpoint. The hosted URL is a working simulated preview, not a verified live Twitch launch. Real chat/Hype/gift delivery, two-streamer pairing, third-streamer isolation on the deployed service, OBS compositing and the login/rescue recording remain outstanding. GitHub remains private; captions was not changed.

## November 1, 2026 — live chat and OBS recording

After broadcaster authorization, verified real AaronKc chat commands reaching the hosted camp and the OBS browser source. With the user's explicit permission, Codex sent `!dig` and `!keep` through Twitch's chat UI. Across three test climbs, the first kept loot on the choice timeout and the next two used explicit Keep commands. The final refresh showed Level 2, 45 ore, 35/100 XP toward the next level, and two inventory items. This demonstrates real delivery and refresh persistence for one account, not organic audience engagement or a two-streamer playtest.

The earlier OBS takes contained an unrelated browser source covering part of the game. A final clean take captured only the live game overlay. Saved the raw recording in the local Movies folder as `2026-11-01 14-19-35.mkv` and exported its first 28 seconds at normal speed as `SCRAWL-live-climb-2026-11-01.mp4` (1280×720, silent). Inspected a contact sheet to confirm the climb and loot result are visible without the unrelated source; the MP4 passed a full ffmpeg decode check. Verified OBS returned to Start Recording; streaming was not started. No paid AI requests were used.

The user emphasized showing effective Codex use in the submission. Updated the storyboard with a clip inventory, links between gameplay and development evidence, and missing shots. Added this capture requirement to AGENTS.md so future recordings preserve it. No application behavior changed in this documentation update; no tests were rerun or claimed as new evidence. These documentation edits are local, not yet pushed. Actual two-community rescues, Hype/gift delivery, login footage, and recorded development examples remain to be captured.

## November 1, 2026 — reliability audit

The user asked whether complexity was making the hosted game slow or unreliable. At inspection, HTTPS health returned 200, the camp reported chat/Hype/gift subscriptions connected, and the saved Level 2 / 45 ore / 35 XP / two items remained intact. Render's 12-hour charts showed low CPU use and memory near 20% of 512 MB. This did not show current resource saturation; subscription status does not prove real Hype/gift delivery.

Found ordinary conversation entering a full game transaction and delivery ledger, and every dashboard/OBS snapshot copying all camps and profiles. Added one shared command filter before persistence, scoped committed reads, and per-audience frame reuse within each broadcast. No schema migration, service, dependency, gameplay feature or AI call was added. Added three-second database query/statement timeouts, a database socket error handler, and a ten-second stalled-loop safeguard that pauses controls and fails health checks. A late tick cannot revive an interrupted coordinator.

Before/after local in-memory benchmark: ten camps with 100 viewers each, twenty iterations of twenty dashboard/overlay snapshots. Median batch time fell from 63.87 ms to 14.59 ms (about 77%); p95 from 68.99 ms to 16.62 ms. Fifty ordinary messages fell from 159.84 ms and 50 persisted delivery IDs to 0.17 ms and zero saves. These are local component measurements, not hosted latency or a production capacity guarantee.

TypeScript and all 102 mocked tests passed. New regression checks cover a 2,000-message ordinary-chat burst with zero transactions, duplicate game commands, copy isolation/rollback, matching frames across multiple OBS windows, separation from host/other-camp data, revoked host sessions, and a stalled save turning health red and rejecting controls. Existing persistence, simultaneous rewards, queue fairness, reconnect, lease handoff and AI-cap checks also passed. Paid API spend for this work: $0. Deployment verification follows separately.


Merged the reliability changes through private GitHub PR #1 (https://github.com/aaronkchsu/scrawl/pull/1), commit `47e2738437569d5a7abb3ed3fd6694bccd8aebe5`. Render auto-deployment `dep-dbjsgu2vcj2c73fck8m0` succeeded; its Docker build independently passed all 102 tests with zero failures. After deployment, `/health` returned 200, the signed-in camp reconnected to chat/Hype/gift subscriptions, and AaronKc still had Level 2, 45 ore, 35/100 XP and two items. This post-deploy check was read-only; it does not add another live climb or prove actual Hype/gift delivery. Saved deployment proof locally as `artifacts/hosted-reliability-deployed.jpg`. No paid AI calls or hosting upgrades were made.
