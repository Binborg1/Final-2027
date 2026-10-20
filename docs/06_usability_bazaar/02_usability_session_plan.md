# Usability bazaar — Session plan (facilitator guide)

**When:** ENSE 400, Tuesday 20 October 2026. **Format:** teams pair up; each team gets about 30 minutes to run a usability evaluation of its prototype with the other team as participants. Expect two or three pairings over the class.

**Prototypes:** high-fidelity is Funza itself, the working app in `app/`. Low-fidelity is `01_low_fidelity_wireframes.html` in this folder: five grey-box screens (home, course page, lesson, lesson with demo, ask Funza and screen share), each with the questions it is meant to answer. Open it in a browser and print it; use the sheets when a pairing wants to talk structure rather than click, and to mark up changes with a pen in the debrief. The pitch deck and the user story map give the bigger picture if asked.

**Roles (swap each pairing):**

- **Facilitator** reads the task cards word for word, keeps time, and does not help. If the participant is stuck for more than a minute, say "what would you try next?", then move on and mark the task "with help" or "not completed".
- **Observer** fills in the observation sheet (below) for every task, writes down quotes, and hands out the questionnaire.

Two participants per pairing is the goal, one at a time if they only have one laptop, both at once on two laptops if we can.

---

## Before class: setup checklist

- [ ] Laptop 1 (and 2 if possible) with Funza running: `cd app && npm run dev`, open http://localhost:3000. Or the Vercel URL if it is deployed by then.
- [ ] Open it in an **incognito window** for each participant, so the five sample courses are there and no earlier progress is saved.
- [ ] Browser is Chrome or Edge, and the **voice works**: open a lesson, click "Voice off" to turn it on, hear the mascot. Volume up.
- [ ] A short lecture PDF on the desktop for task 5: any lecture PDF you have (one from ENSE 472 works); copy it to the desktop and name it `Lecture.pdf`.
- [ ] AI key in `app/.env.local` if you want the AI features visible (free Groq or Gemini key). Without it the app still runs; tasks 1 to 5 do not need it.
- [ ] Four printed copies of `03_usability_questionnaire.md` (or open it on a second laptop/phone) and four copies of the observation sheet below.
- [ ] A timer (phone) and a pen.
- [ ] One of you has tried every task below once, today, so nothing surprises you.

---

## The 30 minutes

| Time | What | Who |
|---|---|---|
| 0:00 to 0:03 | Welcome and briefing (script below) | Facilitator |
| 0:03 to 0:20 | Tasks 1 to 5, about three minutes each; task 6 only if there is time | Facilitator reads, observer notes |
| 0:20 to 0:27 | Questionnaire, filled in by the participant alone | Observer hands it out |
| 0:27 to 0:30 | Debrief: two questions out loud (below) | Both |

### Briefing script

"Thanks for helping. We're testing Funza, a study app that teaches concepts from your lecture PDFs one at a time, with a tutor that gives hints instead of answers. We're testing the app, not you: if something is confusing, that's a finding for us. Please think out loud as you go: say what you're looking for and what you expect to happen. I'll read you short tasks and I won't be able to help during them. We'll take written notes, no recording. It takes about half an hour. Any questions?"

### Debrief questions (out loud, after the questionnaire)

1. "If you had this before your last midterm, would you have used it? What for?"
2. "What's the one thing you'd change first?"

---

## Task cards

Read the **bold** text to the participant. Everything else is for you.

**Task 1 — Find your way in.**
**"You've just opened Funza. Open the sample Computer Networks course, start its first topic, and answer the first question."**
Success: they reach the feedback box (correct or not). Watch for: do they spot the course cards; do they read the explanation or jump to the options; do they find "Check understanding"; any confusion about the SAMPLE badge.

**Task 2 — Get it wrong on purpose.**
**"Go to the next concept. Answer it wrong on purpose. Then, without being told the answer, find out what you got wrong and try again."**
Success: they use the hint or "Try again" (or ask Funza "Where did I go wrong?") and submit a second answer. Watch for: do they notice the hint box and the "Another way to think about it" box; do they look for a "show answer" button; how they react to "Attempt 1 of 3 before you can ask to see the answer".

**Task 3 — The demo.**
**"Go back to the first concept of that topic. There's a demo under the explanation. Play it, answer its question when it stops, then change the number of packets and run it again."**
Success: prediction answered, slider changed, demo replayed. Watch for: do they understand it stopped on purpose; do they read the captions; do they find the slider; does the prediction feel like a test or a nudge.

**Task 4 — The talking tutor.**
**"Turn the voice on, then start Tutor Mode and let Funza talk you through one step. When it's waiting for you, pause it."**
Success: voice on, Tutor Mode started, Pause pressed. Watch for: first reaction to the mascot and the voice (smile, cringe, both); is the speech too long; do they find Voice, Start Tutor Mode and Pause without hunting.

**Task 5 — Your own PDF.**
**"Make a new course from the PDF called Lecture.pdf on the desktop, then open one of the lessons it creates."**
Success: course created, a lesson opened. Watch for: do they understand the "FROM YOUR PDFS" banner; what they say about the quality of a generated question; whether they would trust it.

**Task 6 (if time) — Ask Funza.**
**"Ask Funza what you're looking at, using the box under the mascot."**
Success: a reply appears in the bubble. Watch for: do they type or use the suggested buttons; was the answer useful; do they notice "Share a screen (optional)" and what they think of it.

---

## Observation sheet (one per participant)

Participant: ____ Team: ____ Date: 20 Oct 2026 Observer: ____

| Task | Completed (Yes / With help / No) | Time | Wrong turns, hesitations | Quotes |
|---|---|---|---|---|
| 1 Find your way in | | | | |
| 2 Get it wrong on purpose | | | | |
| 3 The demo | | | | |
| 4 The talking tutor | | | | |
| 5 Your own PDF | | | | |
| 6 Ask Funza | | | | |

Overall: first reaction to the mascot: ____________________ Biggest frustration: ____________________ What they liked unprompted: ____________________

---

## After class: turning it into the 27 October analysis

1. **Score SUS** for each questionnaire: for odd items (1, 3, 5, 7, 9) score = answer − 1; for even items (2, 4, 6, 8, 10) score = 5 − answer; add the ten scores and multiply by 2.5. Above 68 is above average; above 80 is good.
2. **Completion table:** one row per participant with the six task outcomes, SUS, and the top issue. Completion rate per task = Yes ÷ participants.
3. **Issue list:** every wrong turn or complaint from the sheets and the open questions, grouped by screen. For each: how many participants hit it (frequency) and how bad (blocked the task / slowed it / cosmetic).
4. **Design directions:** average the Part C items and tally the Part D ranking to see which of the five directions (hints over answers, voice tutor, demos with predictions, PDF lessons, screen-aware tutor) participants value most.
5. **Redesign list:** the top three frequency × severity issues become next week's changes; note any direction the ranking says to drop or shrink.

| Participant | Team | T1 | T2 | T3 | T4 | T5 | T6 | SUS | Top issue |
|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | |
| P2 | | | | | | | | | |
| P3 | | | | | | | | | |
| P4 | | | | | | | | | |
