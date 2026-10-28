# Collective Doodle Battle / working title: SCRAWL

This repo owns only this project. Do not modify sibling captions files or read its .env.

Product: two gaming/variety communities collectively invent doodles to confront a shared monster. A viewer must understand the entire encounter from one stream. Preserve visible contributions from multiple people; repeated messages must not become power. Crooked ink outlines, flat colors, ruled paper, absurd anatomy, expressive simple motion. Do not copy the existing dragon reference character.

Keep one Node 24 TypeScript server and browser-native HTML/CSS/JS. No shared framework, microservices, database, or image generation dependency for the first encounter. AI returns validated drawing data; it never executes code or controls scoring. The server owns game state and both overlays receive its snapshots. Offline demo art/interpretation must remain explicitly labeled; never imply it is live AI or real Twitch chat.

Run `npm run check` and `npm test` after logic changes. Test contributor balancing, state transitions, stale generation results, reconnects, and failure paths. Use browser QA for visible interactions. Keep evidence and limits in docs/build-log.md, not invented development history.

Secrets stay on the server and out of git, logs, URLs, fixtures, screenshots, and browser bundles. Development binds loopback by default. Remote control requires CONTROL_TOKEN. OBS views are read-only.
