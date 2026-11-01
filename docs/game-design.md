# Excavation: decisions, rewards, and chat interference

Design review, October 30, 2026. These are hypotheses to test with viewers, not evidence that the game is already fun or will win a competition.

## What to borrow from games people already play

| Example and primary source | Observable mechanic | Application here |
| --- | --- | --- |
| [Marbles on Stream — developer's getting-started guide](https://www.pixelbypixelstudios.live/getting-started) | A chat command enters a named marble; the race then runs automatically. | Keep entry to `!dig`, make the viewer's explorer recognizable, and let the action run while they watch the stream. |
| [Sea of Thieves — Season 15](https://www.seaofthieves.com/season-15) | Flying an Emissary flag increases the reward for delivered loot and makes the crew a target. | Risk should be a choice made before exposure. Banking at the cache is safe; choosing the upper climb opens the possibility of gift rocks when the streamer has enabled them. |
| [Into the Breach — Subset Games](https://subsetgames.com/itb.html) | Enemy attacks are telegraphed so players can reason about counters. | Show the threat, odds, HP, and shield behavior. Our eight-second rock warning provides anticipation; it does not pretend to offer a last-second dodge over a delayed stream. |
| [Sea of Thieves — design director's Emissary balancing note](https://www.seaofthieves.com/community/forums/topic/114730/balancing-emissaries) | The team adjusted rewards after observing a repeatable progression shortcut. | Check which action our incentives actually reward. Tune from observed play, not from a list of desirable features. |

These applications are our design inferences. The sources describe their own mechanics and do not establish that the same rules will work for this overlay.

## The decision has to be a real tradeoff

This is partly decision theory: one viewer chooses between certain loot and uncertain loot. It becomes a multiplayer incentive problem when other viewers can affect that outcome. More currencies, timers, or flashing lights do not automatically improve either problem.

Before this change, each of the three upper rooms had a 55% chance of dealing 2 HP damage. With 2 HP and no protective gear, one hit ends the climb. Survival was `0.45³ = 9.1125%`. Banking 15 ore beat the risky ore expectation of `50 × 0.091125 = 4.56`. The crown and additional XP still had value, so Risk was not strictly dominated for every player, but the ore decision was heavily tilted toward Keep.

The starting balance now uses a 35% hit chance in each upper room:

| At the cache, no protective gear | Keep now | Survive all upper rooms | Expected ore if risking |
| --- | --- | --- | --- |
| 2 HP | 15 | `0.65³ = 27.4625%` | 13.73 |
| 3 HP | 15 | `0.65³ + 3 × 0.35 × 0.65² = 71.825%` | 35.91 |

This gives health and gear a reason to matter. A cautious 2 HP player has a sensible reason to bank; a healthy player has a stronger reason to risk. A collector may still take the lower odds for the crown. The calculation excludes the value of gear, XP, time, future Hype changes, and gift rocks; it is a diagnostic, not a universal player-utility model.

The UI calculates route survival from the actual remaining rooms, HP, and shield state. Boots remove gap damage, and an unused shield changes the damage branches. Summit ore uses the run's current boost and lantern. The displayed route odds explicitly exclude future gift rocks.

Hype multiplies ore, not survival. If all rewards are uniformly tripled, that alone does not change their relative expected value. Starting or upgrading Hype mid-run can change the remaining upside because already collected ore is not retroactively multiplied. XP levels are cosmetic and ore remains a saved score; a meaningful use for excess ore is still missing.

## Two events with different jobs

**Hype Train is a shared benefit.** The affected channel gets sustained gold shaft lighting, a large 2×/3× label, and boosted ore popups. Active and queued climbs retain the highest boost they received. It does not add HP, XP, or extra queue entries.

**Gift subs are optional interference.** The streamer must turn gift rocks on. New climbs record that setting, and the cache states the consequence before the viewer chooses Risk. Lower rooms, waiting viewers, and viewers choosing Keep cannot be targeted. Enabling the setting does not expose an already-running climb.

A valid gift event chooses one random eligible upper climber in the gifting channel. An eight-second warning pauses that climber's room timer. One independent roll then has a 35% chance to deal 1 HP; an unused shield blocks it. It can end a run already at 1 HP. The climb resumes afterward. No extra reflex command is required.

- One rock opportunity per climb, including misses and blocks.
- At most one rock per channel per 30 seconds.
- A batch of gifts is one opportunity. Larger batches add decoration, not damage or hit probability.
- The gifter cannot name a victim or win loot from hurting someone.
- Gifts with no eligible target do not accumulate a future attack queue.
- Turning rocks off cancels pending rocks and keeps those existing runs safe if the setting is re-enabled.
- Disconnect, reset, duplicate delivery, and old-session messages cannot apply stale damage.
- XP and previously banked items/ore survive death.

These caps bound one viewer's ability to spoil another viewer's session. The remaining question is social: does the target laugh at the interruption or feel punished for participating? Streamer opt-in is necessary but does not answer that question. Test it with viewers.

## Why not add ten more systems yet

The current loop has four reasons to return: identity, a visible journey, one consequential choice, and a permanent find. The immediate improvement is to make each leg understandable and satisfying.

Next candidates, in order, after a playtest:

1. **A collection worth completing.** Original visible accessories and a small collection checklist. Avoid endlessly raising stats until newcomers cannot participate.
2. **A positive social action.** Keep now sends a capped rescue rope to a linked camp. Regular subscription supplies are still not implemented.
3. **A shared discovery.** Reciprocal rescues now earn a joint keepsake; chat-generated caves are implemented below; a collection museum remains a future idea.
4. **Queue pacing.** Three slots and a long queue become a bottleneck with a large audience. Measure wait time before adding more visible characters or parallel background expeditions.

## Small playtest before more code

Use 5–8 people, with free simulated events, for about 10–15 minutes. Alternate the order of rocks-off and rocks-on sessions between groups. Let participants play without a verbal tutorial first.

Observe whether they can join, identify themselves, explain Keep versus Risk, distinguish Hype from gifts, and understand why a run ended. Record Keep/Risk by HP and gear, time waiting, repeat climbs without prompting, missed choices, and reactions to being targeted. Ask which moment they wanted to watch and which felt unfair.

Do not optimize only for retention, gift count, or choosing Risk. Both choices should feel defensible. A 5–8-person test can expose confusion and frustration; it cannot establish broad audience preferences or statistical balance.

## Integration and evidence

[Twitch's gift-sub documentation](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsubscriptiongift) specifies `channel.subscription.gift` v1 and `channel:read:subscriptions`. [The event reference](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#channel-subscription-gift-event) supplies the batch total and anonymous status. The adapter handles those fields, keeps chat working if gift access fails, and restores capability indicators on an EventSub transfer.

Use the playground's simulated Hype and gift buttons to test without buying subscriptions. Live end-to-end Twitch testing and audience playtesting remain outstanding. See the build log for executed checks.


## Cross-community rescue line — implemented October 30

Keep has two visible outcomes: the viewer banks their loot and, when ready, sends a rope to the other camp. Risk keeps the personal upside of a summit run. Incoming help is shared by the destination camp, so it is not guaranteed to protect a particular climber. Catching a fatal fall ends that run and banks only loot collected before the failed obstacle; it does not turn failure into a summit win or grant a crown. Fatal gift rocks use the same rule.

This creates a reason to thank a named person in another community without asking viewers to watch another stream. Both overlays show the supply cart, donor, recipient, channel names, and saved loot. One successful rescue in each direction awards the involved viewers a Linked Lantern cosmetic recording that collaboration. It adds no combat power. Saved profiles keep at most 20 camp-pair keepsakes; a repeat pair updates its record rather than farming duplicates.

Both camps have the same one-rope capacity and one-minute sending cooldown. Deliveries take three seconds. Duplicate commands cannot stack ropes or rewards, a viewer cannot catch their own rope after switching channels, and unattended timeout choices do not send help. When both camps are waiting, the shared queue alternates camps while keeping arrival order within each camp. These limits bound throughput; they do not claim to remove every large-audience advantage or prevent people coordinating with alternate accounts.

Hype in the sending camp adds a fixed five ore to the next successful rescue from that supply. It does not add another rope or multiply the recipient's loot. Disconnecting a partner drops pending ropes, while ordinary solo climbs continue. Changing the channel pair or restarting the game clears shared rescue progress; saved keepsakes remain.

The demo's Try a rescue starts directly at four held choices, automatically selects Noodle and Mossboss, and uses fixed falls. Normal demo/live routes retain their regular randomness. Labels disclose the scripted practice throughout. The practical playtest is whether viewers can explain who helped whom and want to return that help. The mechanic is implemented, not yet validated with an audience.


## Chat makes the other camp’s cave — implemented October 31

Three to six distinct viewer ideas become a named cave, original pixel enemy and collectible, and one of three bounded route variants. Each camp creates the other’s next cave; a solo channel creates its own. Both streams show the source camp and contributors. Keeping loot at room 3 or later banks the cosmetic find with its authors. A failed run keeps previously owned items.

The intended appeal is seeing an idea visibly combined with other people’s ideas, then watching the other community explore it. This is a hypothesis, not a claim that generation alone makes the game fun. The next playtest should ask whether participants recognize their contributions, care about another camp’s find, and can explain the route rule without help.

This uses a pretrained generative model. It is not trained or updated on viewers, does not infer personalities or feelings from chat, and does not optimize donations or retention. Only selected idea text and opaque message IDs enter the model request; viewer identities stay in server-side credit records. No outcome telemetry is currently used to train anything.

The model may choose two upper gaps, three upper enemies, or a safe crystal followed by two enemies. Damage, hit chances, HP, gear effects, and rewards stay under game rules. Actual route survival is recomputed for the chosen variant; this is not equal difficulty across variants. Existing climbs lock their cave when they start. Cosmetic finds add no power and are awarded once per viewer/cave.

One idea per viewer and collapsing copied ideas prevents message spam from adding prompt slots. Up to six ideas are sampled from at most 200 contributors per camp, with three distinct ideas required. The cap still favors arriving within that window and does not prevent alternate accounts; do not describe it as perfect audience-size fairness. Used ideas/copies clear on success so later contributions can enter. New and edited unused ideas survive the generation wait. Failure preserves the selected batch for an explicit paid retry and leaves the old cave playable.

Generation requires a host action and consumes one attempt within the existing cap. Normal climbing, rescue practice and chat submissions make no requests. Caves are session-scoped; collected finds persist. Avoid spending another request just to replay a cave.
