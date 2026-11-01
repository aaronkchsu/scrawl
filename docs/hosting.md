# Hosted pilot

Use the private `aaronkchsu/scrawl` repository and its `render.yaml` as a Render Blueprint. It defines one 0.5 CPU / 512 MB Node container in Oregon and one 256 MB managed Postgres database with 5 GB storage in the same region. Database public access and storage autoscaling are disabled. Confirm the current price in Render before creating resources. The web compute price observed on November 1 was $7/month; database/storage charges are additional.

## First deployment

1. Connect Render to the private repository, then create a Blueprint from `main`.
2. Supply this game's `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in Render's secret fields. Do not copy the captions app's credentials. Leave paid AI unconfigured initially.
3. Keep the generated `TOKEN_ENCRYPTION_KEY` stable. Store a secure backup outside Git. Changing it makes stored Twitch tokens unreadable; users would have to reconnect.
4. The service uses Render's `RENDER_EXTERNAL_URL`. Register the exact `https://<service>.onrender.com/auth/twitch/callback` in the Twitch application. No localhost callback in production.
5. Open the hosted URL, sign in, copy the channel-specific OBS URL and open camp. A second broadcaster signs in independently and accepts a one-use invite.
6. Verify `/health` returns 200. Configure `/health` as Render's health check, not the homepage.

The app can serve practice before Twitch credentials are configured. That is a preview, not a completed Twitch launch. `DATABASE_URL` selects hosted mode; without it the legacy local single-host server runs. Never deploy the legacy mode as public signup.

Every Render build runs TypeScript checks and the mocked test suite in a separate Docker stage before creating the production image. The final image contains production dependencies only. Deployments follow commits and fail if those checks fail; they do not depend on GitHub Actions availability. GitHub's account billing lock currently prevents its additional Actions workflow from running. The Docker build itself still needs verification on Render because Docker is unavailable locally.

## AI and costs

The Blueprint imports the existing ledger once: 13 attempts, 10 reported responses, 7,327 input and 20,229 output tokens, against a total cap of 14 attempts. An incomplete response may be billable without reported token usage. Do not reset the initial counts to gain more allowance. The hosted ledger is in Postgres; local `.runtime` files are not uploaded.

To enable paid caves, set `OPENAI_API_KEY` and the operator's numeric Twitch user ID in `OPERATOR_TWITCH_IDS`. The operator then enables individual registered streamers under **Limits & usage → Operator controls**. Every generation/retry is explicit. Requests are reserved transactionally before starting, including failures and interrupted attempts. Normal climbs never call AI. New accounts default to built-in caves.

Set `HOSTING_MONTHLY_ESTIMATE_USD` after verifying the actual web+database+storage price. Usage shows hosting separately from AI token counts. The $100 project budget and request cap do not automatically stop Render billing. Check provider billing; suspend the web service and arrange a database backup/removal when the pilot ends. Turning off a web service does not stop database charges. No automatic paid preview environments or extra replicas are configured.

## Persistence and recovery

One coordinator owns a ten-second database lease. A deployment requests handoff; the old process stops consuming events before the replacement acquires the lease. A failed save pauses play and fails `/health`; Render restarts an unhealthy running instance after sustained failures. Overlays reconnect to full snapshots. This may briefly interrupt the stream overlay during deployment; it is not a multi-server availability guarantee.

Postgres holds encrypted Twitch credentials, hashed web sessions/invites, room membership, settings, caves, queues, runs, viewer progress, deduplication IDs and the AI ledger. The lease/metadata row and changed room/profile rows commit in the same transaction, so loot and the triggering event are saved together. Idle ticks update the small lease row without rewriting inventories. Active run deadlines shift by downtime on restart; expired Hype Trains do not continue indefinitely. Incomplete AI jobs offer retry with their original ideas.

Twitch tokens are validated at startup/hourly and refreshed before expiry. Revoked authorization invalidates associated website sessions. WebSocket reconnections recreate subscriptions unless Twitch transfers the existing session. Unavailable Hype/gift events do not block chat. Twitch does not replay chat or events missed during a connection gap.

OBS snapshots contain broadcast game state only; no tokens, web sessions, host capabilities or private idea pools. Streamer controls require an authenticated same-origin session and derive channel ownership from that session.

## Capacity and remaining verification

The pilot allows ten open rooms; other accounts can sign up and practice. A room supports two channels, three climbers, 100 queued players and 1,000 joined viewers. Only 32 resting avatars appear at once. There is one authoritative service instance; do not enable autoscaling. The load test covers 10 × 100 simulated participants and database reload. It does not establish arbitrary production throughput or concurrent browser limits.

Before marking launch complete, record the hosted URL and successful deployment, run two real Twitch accounts plus an unrelated third account, verify the OBS browser source and a cross-camp rescue, and capture a short recording. Mocked tests and browser previews are labeled as such in `build-log.md`.

References: [Render Blueprint](https://render.com/docs/blueprint-spec), [health checks](https://render.com/docs/health-checks), [deploy lifecycle](https://render.com/docs/deploys), [Twitch token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/).
