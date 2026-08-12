# Call Tracker — Arcade Edition

**Author:** Micah Levason
**Live:** <https://micah4thewin.github.io/calltracker/>

A local-only call tracker for T-Mobile care, tech support and Team of Experts.
It turns the repetitive parts of a shift into something with a scoreboard, so
consistent behaviors happen because they are satisfying, not because someone is
watching.

Built for a brain that needs feedback loops: one thing to do next, instant
response to every tap, visible progress, and a debrief at the end that actually
tells you something.

---

## Overview

Start a call, tick what you actually did, end the call. That is the whole loop.
Everything else — XP, ranks, streaks, trophies, quests, callback detection and
the end-of-shift report — builds itself from those ticks.

The recap lands on your clipboard the moment the call ends.

## What it tracks

**At the start of every call**

- Verified or not verified
- Escalated caller (auto-copies a Teams heads-up)
- Cancel / port-out risk (auto-copies a churn heads-up)
- Account number, phone number, or any free-form reference — and it copes fine
  when there is nothing at all to identify the customer
- Reason for the call, from a 20-item T-Mobile taxonomy

**The behavior board** — grouped into OPEN → DISCOVER → SOLVE → CLOSE

| Phase | Behaviors |
| --- | --- |
| Open | Verified the customer · Acknowledged tenure · **Restated the issue + verbal confirm** · Set expectations |
| Discover | **Full account audit** · SDL triage (Situation / Duration / Location) · **Checked account balance** · Payment arrangement · Attempted to collect |
| Solve | Used NBA · Used Headstart · T-Mobile ID · T-Life walkthrough · Sent self-help · **Sent the personal guarantee text** · Bill walked line by line |
| Close | **"So you do not have to call back…"** · Recapped next steps · Retention save attempt · Thanked by name |

The five in bold are the **CORE 5**. Land all five and the call scores a combo,
extends your streak, and pays a bonus.

**Account facts** — the data layer behind the insights

Verified · escalated · cancel intent · past due · payment arrangement on file ·
payment collected (with amount) · billing questions · has T-Mobile ID · able to
use T-Life · resolved.

Past due unlocks the arrangement question; no arrangement unlocks the collection
prompt. **Resolved defaults to NO** on purpose — you earn the yes.

Behaviors only appear when they are actually in play: SDL shows on technical
calls, the bill walk shows when there are billing questions, the save attempt
shows on cancel calls. Less noise, and the score is measured against what the
call actually needed.

## Emergency help

A rail of one-click buttons that copy a ready-to-paste Microsoft Teams message:

- 🔥 Escalated caller, coming in HOT — I need someone to tap in
- 🚪 Cancel / churn risk — that is all I know right now, will update
- 💰 Collected past due money (with the amount and a money one-liner)
- 📣 Supervisor requested · 🆘 Need an assist · 🔒 Cannot verify caller
- 🛡️ Retention save · 📡 Possible outage · ⏳ Long call · 🚨 Fraud · 🏆 Small win

Every message ends with a masked reference — customer, reason, timestamp — and
every message is editable with the pencil. Marking a caller escalated, a call a
cancel, or logging a collected payment fires the right message automatically.

## The game layer

- **XP and ranks** — 13 ranks from Rookie Rep to Legend of the Line, then
  prestige stars
- **Momentum** — chaining behaviors inside a call multiplies the XP, up to 2×
- **CORE 5 streak** — consecutive calls where all five core behaviors landed
- **Daily quests** — three per day, deterministic, claimable for bonus XP
- **23 trophies** — from First Contact to Churn Breaker and Clean Slate
- **Grades** — every call scores S / A / B / C / D against what applied
- Confetti, screen flashes and synthesised sound effects, all individually
  switchable (sound is **off** by default so nothing leaks into a live call)

## Callback radar

Identifiers are normalised locally — phone numbers match on the last ten digits
— so when someone calls back you see it before you say hello: how many prior
calls, how long ago, what it was about, whether it was resolved, and the note
you left yourself last time. The report aggregates this into a repeat-caller
rate and a per-customer breakdown.

## The debrief

An ASCII document, 78 columns wide so it survives being pasted anywhere,
covering today / 7 days / 30 days / all time:

- Mission control — rank, XP, streak
- The numbers — volume, AHT, hold, resolution, repeat rate, escalations,
  cancels, money collected
- Behavior consistency — bar chart per behavior, marked for strengths and gaps
- Why they called — reason breakdown, plus which reasons are hardest to resolve
- Money & retention · Digital adoption · Callback radar · Time on the line
- **Does it actually work?** — resolution rate *with* each behavior versus
  *without* it, so you can see which habits are earning their keep
- **Read this part** — generated coaching, ending in a one-behavior action plan
- Full call log, flag legend, and a trophy case

Copy it, or download it as a `.txt`.

## Keyboard

Single-key shortcuts toggle every behavior while a call is live (the letter is
printed on each card). `/` jumps to the ID field, `Enter` starts the call, `H`
holds, `X` ends, `G` opens the debrief, `?` shows everything, `Esc` closes.

## Privacy, security and CPNI

This is the part that matters in a call centre, so it is worth being precise:

- **No server.** There is no backend. Nothing is uploaded, ever.
- **No third-party code.** No Bootstrap, no SweetAlert, no AOS, no LocalForage,
  no Google Fonts, no CDN of any kind. Every line of CSS and JavaScript is in
  this repository.
- **No network requests at all.** Once the page has loaded it makes zero
  requests — no fetch, no XHR, no beacons, no websockets, no analytics, no
  telemetry. Verified in an automated browser test that fails if a single
  external request is made. You can run it with the network unplugged.
- **No fonts or images to fetch.** System font stacks and an inline SVG favicon.
- **Data stays in `localStorage`** on that one browser on that one device.
- **Customer IDs are masked** to the last four digits in the recap, in the
  report, and anywhere text is copied. There is an explicit toggle if you need
  the full value, and it defaults to off.
- **Sound is off by default**, so nothing unexpected plays over a live call.

Clearing your browser data deletes everything — export a JSON backup from
Settings if that matters. Old calls are pruned automatically after the retention
window (180 days by default) to stay inside the browser storage limit.

## Running it

Open <https://micah4thewin.github.io/calltracker/>, or clone the repo and open
`index.html` directly — it works from `file://` with no build step, no
dependencies and no install. History from the pre-3.0 version is imported
automatically on first load.

## Layout

```
index.html        markup shell
style.css         all styling
js/config.js      behaviors, flags, reasons, ranks, trophies, quests, templates
js/store.js       localStorage persistence, scoring, stats, correlations
js/ui.js          toasts, modals, confetti, WebAudio sound, clipboard
js/report.js      the ASCII debrief
js/app.js         wiring and the game loop
```

## Licence

GPL-3.0. See `LICENSE.txt`.
