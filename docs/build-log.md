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
