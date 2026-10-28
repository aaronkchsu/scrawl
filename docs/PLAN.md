# Product decisions and next milestones

## Agreed direction

- Gaming/variety streamers running a short event between gameplay.
- Two communities collaborating against one shared boss; both inventions, ballots, and locked recipes visible from either stream. Individual impact is a contribution readout, not a rival winner.
- The monster encounter is central. Collective invention and readable consequences should sustain engagement.
- Rough original notebook doodles, flat color, absurd anatomy and simple expressive animation.
- Meaningful contributions from multiple viewers; spam and last hits must not determine the winner.
- No need to watch the opposing stream or join a voice call.
- Planning budget supplied by the user: 20 hours and $100, treated as this project's ceiling. Track actual effort/spending; do not imply this allowance has been consumed.

## Accepted refinement after the Astra review

- Keep the shared boss. Defer Build/Sabotage and separate boss encounters.
- One valid nomination per viewer, uniform sample of 12 unique nominees, then up to three finalists per community. Exact repeat phrases do not occupy multiple slots.
- One 12-second vote selects the lead creature/object and its declared counter; the other finalists supply compatible visual details. Ties/no votes are random among real finalists. A sparse chat is not padded with invented nominees.
- Published counters determine combat; AI draws their visible equipment and credits each finalist. One drawing per nonempty community per round. No per-message interpretation calls.
- Both communities get the same fixed power budget. Larger-group creative advantages remain a playtest question.
- A successful encounter ends in a shared finishing move using both existing drawings, with no additional generation call.

## First implementation milestone

A locally runnable, explicitly labeled offline encounter with original authored SVG art, real-time collective updates, two read-only perspectives, a fixed scored fight, contributions, and replayable demo input. Optional Twitch and live AI adapters are implemented separately. Local browser QA does not establish real-stream performance or generative-art quality.

## Product gates still outstanding

1. Obtain two user-controlled channels or willing streamer partners. Owners authorize the app themselves. Recruit several actual participants; fixture playback isn't a substitute for observing real collective behavior.
2. With credentials, run ten representative chat fixtures through live AI. Proposed gate: eight of ten suitable inputs produce a coherent drawing visibly incorporating three distinct authors. Have a viewer identify the creature and two contributed features.
3. Measure generation time, cost, readability and response rates. Initial latency target: usable output within ten seconds for most trials; this is not a measured result or promise. Reconsider window length/drawing approach from evidence.
4. Test one full match on two real streams, including reconnects, slow generation, audience-size differences and video delay. Server synchronization does not make Twitch video arrival simultaneous.
5. Make the shared combo and monster response legible to viewers without reading the scoring formula. The current fixed ability rules need playtesting for fun, not just correctness.
6. Deploy one single-instance coordinator, then test account-owner onboarding and both remote OBS sources.

## Scope boundaries

One boss, two rounds. No matchmaking, billing, progression, custom physics, many bosses, automatically reading stream video, generated animation frames, or random scheduling. None of these is required to prove the core loop.

## Time allocation

Target 15 hours for implementation and 5 for real testing, recording and editing. These are planning allocations, not measured progress. Aim for playable freeze by October 30, real-stream test and capture October 31–November 1, submit before November 2 at 3 p.m. Denver time. Reassess against actual available hours and credentials.

## Competition evidence

Show a small, real Twitch interaction and several actual contributors becoming one creation; one stream should explain the complete encounter. Capture actual Codex design changes, implementation decisions, checks and fixes. Keep synthetic input labeled. Preserve sources, setup instructions, model/session identification and permissions for recorded participants. Submission quality depends on the working experience and evidence, not promised features.
