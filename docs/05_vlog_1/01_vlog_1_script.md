# Vlog 1 — Script and filming guide

**Length:** about 9 minutes (limit is 15). **Speakers:** Aubin and Chop. **Shots:** 17.

There are two kinds of shot:

- **CAMERA**: you're on camera, talking to the viewer. Filmed on a phone.
- **SCREEN**: a screen recording, with one of you talking over it (voice-over). Recorded on a laptop.

They're filmed separately, at different times, and joined afterwards in Clipchamp. You never film both at once.

---

## Part A — Filming guide

### What you need

- A phone, and something to prop it up at eye level (a tripod, or a stack of books).
- A laptop with **OBS Studio** (free, obsproject.com) for the screen recordings.
- **Clipchamp** (built into Windows 11) for putting it together.
- Earbuds or a headset with a mic for the voice-overs. Optional, but it sounds much better.

### Shot list

| Shot | Type | On screen | File / place | Voice |
|---|---|---|---|---|
| 1 | CAMERA | Both of you | — | Both |
| 2 | CAMERA | Chop | — | Chop |
| 3 | SCREEN | The "upload to ChatGPT" routine | A course folder of PDFs, then chatgpt.com | Chop |
| 4 | CAMERA | Aubin | — | Aubin |
| 5 | SCREEN | Competitor table | Pitch deck, slide 6 | Aubin |
| 6 | CAMERA | Both of you | — | Both |
| 7 | SCREEN | Who it's for, then the user table | Pitch deck slide 3, then `docs/02_workshop_2/01_user_analysis.pdf` | Chop |
| 8 | SCREEN | Stakeholder table | `docs/04_workshop_3/03_stakeholder_analysis.pdf` | Aubin |
| 9 | SCREEN | Free and Pro plans | Pitch deck, slide 7 | Aubin |
| 10 | SCREEN | **The Funza app** (the most important shot) | `app/`: run `npm run dev`, open http://localhost:3000, attach a short lecture PDF (not kept in the repo) | Chop |
| 11 | SCREEN | Release plan | `docs/04_workshop_3/11_user_story_map.png` | Aubin |
| 12 | CAMERA | Chop | — | Chop |
| 13 | SCREEN | The code | VS Code with the `app/src` folder open | Aubin |
| 14 | SCREEN | RACI chart | `docs/04_workshop_3/10_raci_chart.pdf` | Chop |
| 15 | SCREEN | Schedule | `docs/04_workshop_3/12_gantt_chart.png` | Aubin |
| 16 | SCREEN | Kanban board | https://github.com/users/Binborg1/projects/1 | Aubin |
| 17 | CAMERA | Both of you | — | Both |

Pitch deck = `docs/03_pitch/02_final_pitch_cultivator_hq.pptx`. Open it in PowerPoint and press **F5** for full screen.

### Session 1 — Camera (shots 1, 2, 4, 6, 12, 17)

About 30 minutes. Do all of them in one sitting so your clothes and the lighting match.

1. **Room:** quiet, with a window **in front of you**, not behind you. Turn off fans and close the door.
2. **Phone:** landscape (sideways), at eye level, about an arm and a half away. Set it to 1080p and put it on Do Not Disturb.
3. **Framing:** chest up. For shots 1, 6 and 17 sit side by side with both of you in frame. For the solo shots (2, 4, 12), the speaker sits in the middle.
4. **Script:** keep this file open on a laptop right beside the phone, so your eyes stay near the lens while you read.
5. **Test:** record ten seconds and play it back with sound. Fix anything before you go on.
6. **Record:** read only the CAMERA blocks, in shot order. You can leave the phone recording the whole time. Before each shot, say its number out loud ("shot four"), wait two seconds, then start. That makes it easy to find in the edit. If you trip over a line, pause and say the whole sentence again. Do each shot twice, and keep the better take.

### Session 2 — Screen (the other 11 shots)

Each person records their own voice-over shots, so you can do them separately:

- **Chop:** shots 3, 7, 10, 14
- **Aubin:** shots 5, 8, 9, 11, 13, 15, 16

**Set up OBS once:**

1. **Settings → Video:** set both resolutions to 1920x1080.
2. **Settings → Output:** pick the folder the recordings save to.
3. **Sources → + → Display Capture:** this records your whole screen.
4. **Audio Mixer:** check that "Mic/Aux" moves when you talk. If you have a headset, choose it in Settings → Audio.
5. Turn on Do Not Disturb in Windows, close every other app and tab, and hide the browser bookmarks bar.

**For each shot:**

1. Open the file or page from the shot list, full screen. Zoom PDFs to fit the width.
2. Press **Start Recording** in OBS, wait two seconds, then read that shot's voice-over while you scroll slowly or point with the mouse.
3. Leave a one-second pause between paragraphs, then press **Stop Recording**.
4. Rename the file to its shot number, for example `03-screen.mp4`.

**Careful:** in shot 13, don't open `app/.env.local`. It holds the AI key, and anyone watching could copy it.

### Putting it together in Clipchamp

1. Copy the phone video to the laptop (USB cable, Google Drive, or the Phone Link app).
2. Cut it into one clip per shot and name them `01-camera.mp4`, `02-camera.mp4` and so on. Saying the shot number out loud while filming makes the cut points easy to find.
3. In Clipchamp, go to **Create a new video → 16:9** and import all 17 clips.
4. Drag them onto the timeline in order, 1 to 17.
5. Trim each clip. Click where the talking starts, press **S** to split, and delete the dead bit. Do the same at the end, and for any retakes.
6. Click **Text** to add:
    - your names under you in shot 1,
    - the `BAD:` / `PMBOK:` captions where the script shows them,
    - WHY, HOW and WHAT in shot 6,
    - the GitHub link in shot 17.
7. Play the whole thing once. Check the volume stays steady between camera and screen clips. Clipchamp's **Audio → Volume** fixes a clip that's too quiet or too loud.
8. **Export → 1080p.** Check it's under 15 minutes.

How the timeline flows:

```
1 CAM  → 2 CAM → 3 SCR → 4 CAM → 5 SCR → 6 CAM → 7 SCR → 8 SCR → 9 SCR
both     Chop    Chop    Aubin   Aubin   both    Chop    Aubin   Aubin

→ 10 SCR → 11 SCR → 12 CAM → 13 SCR → 14 SCR → 15 SCR → 16 SCR → 17 CAM
  Chop     Aubin    Chop     Aubin    Chop     Aubin    Aubin    both
```

A camera clip followed by a screen clip in the same voice (2 then 3, or 4 then 5) feels like one person who just started showing you something. That's why it works even though the clips were recorded on different days.

---

## Part B — Script

### Part 1 — Who we are (about 0:45)

**SHOT 1 — CAMERA: both of you.** Name captions. `PMBOK: Roles and Responsibilities`

**AUBIN:** Hi, I'm Aubin Chriss Izere.

**CHOP:** And I'm Chop Kur. We're Software Systems Engineering students at the University of Regina, and this is our capstone project, the AI Learning Environment. The app is called Funza.

**AUBIN:** We started this together and we share the project management. We split the work by feature. I'm building the PDF reader, the AI part and the explanations. In the winter I'll add voice input and the iPad version.

**CHOP:** I'm building storage, flashcards and quizzes. In the winter I'll add accounts, the paid plan and review planning. Before anything goes into the project, the other person checks it.

### Part 2 — The problem (about 2:00)

**SHOT 2 — CAMERA: Chop.** `BAD: Business Case`

**CHOP:** Let me start with a problem we both have. I'm studying for a midterm. I've got the lecture PDF open, and there's a page I just don't get.

**SHOT 3 — SCREEN: Chop's voice.** Open a course folder full of PDFs. Open ChatGPT, upload one PDF, and type "This is from my ENSE course, can you explain page 14?" Show the answer coming in.

**CHOP:** So I open ChatGPT. I upload the file. I explain which course it's from. Then I ask my question. And the next time I study, I have to do all of that again. When the answer comes back, it doesn't tell me which page it came from, so I can't check whether it's right. And if I want flashcards to study from, I have to make them myself in another app.

**SHOT 4 — CAMERA: Aubin.**

**AUBIN:** It's the same for me. And really, it's bigger than the two of us. Anyone trying to understand a document runs into this. But our biggest market, and who we're building for first, is students.

**AUBIN:** We interviewed Linda, a U of R student, and she told us the same thing. Asking ChatGPT felt awkward, because she had to upload her files every time just to give it context. She said it would be so much smoother if it could just see the file she's studying and explain it.

**SHOT 5 — SCREEN: Aubin's voice.** Pitch deck slide 6. Point at each row as you name it. `BAD: Competitor Analysis`

**AUBIN:** There are tools out there already. NotebookLM gives good answers with sources, but you upload every file first. Adobe Acrobat's AI only works on one PDF at a time, and it doesn't help you practise. ChatGPT explains well, but you set it up from scratch every session. And Anki and Quizlet are great for flashcards, but you make every card by hand.

**AUBIN:** None of them teach you from the files already on your laptop, check that you actually understood, and turn it into practice. That's the gap we're filling.

### Part 3 — Why we're building it (about 1:10)

**SHOT 6 — CAMERA: both of you.** Add WHY, HOW and WHAT as captions as you say them. `PMBOK: Project Charter`

**CHOP:** So why are we building this? Because we think students should be able to learn from the material they already have, and trust the answers they get.

**AUBIN:** How do we do that? Funza teaches from your own course files. It keeps explaining until it clicks for you. And it shows you where every answer came from.

**CHOP:** And what is it? An AI tutor for your course PDFs. It's free to start, and there's a Pro plan if you want stronger AI models.

**AUBIN:** If you remember one thing, make it this. It explains the page you're reading, shows you where the answer came from, and turns it into practice.

**AUBIN:** Here's what changes when we're done. Right now, studying with AI means re-uploading your files and getting answers you can't check. When we're done, you'll have a tutor that already has your notes, teaches you until you understand, and shows you where every answer came from.

**CHOP:** To get there, we need to test our prototype with students on October 20, make sure the free AI models are good enough, and ship our first release by December 1.

### Part 4 — Who it's for (about 1:30)

**SHOT 7 — SCREEN: Chop's voice.** Pitch deck slide 3, then scroll through the User Analysis PDF. `BAD: User Analysis`

**CHOP:** We're building it first for U of R students, mostly second to fourth year in engineering, science and business. They study from lecture slides and textbook PDFs. They already use ChatGPT for help. And they cram before midterms on a student budget. What they want is simple: understand things faster and walk into exams ready. Graduate students, who read lots of research papers, are our second group.

**CHOP:** And they're right here on campus in Regina, so we can test with them between classes. They get their information online, from UR Courses, ChatGPT, YouTube and each other. So we'll grow by word of mouth, starting with the classmates who test it.

**SHOT 8 — SCREEN: Aubin's voice.** The Stakeholder Analysis PDF. `PMBOK: Stakeholder Analysis`

**AUBIN:** The people whose opinion matters most are Dr. Maciag, who grades our work; Linda and the classmates testing the app; our capstone classmates at the testing session; and the mentors at Cultivator HQ who heard our pitch.

**SHOT 9 — SCREEN: Aubin's voice.** Pitch deck slide 7. `BAD: Business Model Analysis`

**AUBIN:** On the business side, students already have lots of free tools, and they don't like paying for subscriptions. So Funza is free to start, on free AI models. The Pro plan unlocks stronger models, and it pays for what those models cost. We're funding this ourselves, on a budget of up to 150 US dollars.

### Part 5 — What we're building (about 2:00)

**SHOT 10 — SCREEN: Chop's voice.** The Funza app. Add a course, attach a short lecture PDF (not kept in the repo), open a lesson and turn the voice on. Answer one question wrong on purpose, show the hint, then answer it right. `PMBOK: Requirements`

Before you record: add a free Gemini or Groq key (copy `app/.env.example` to `app/.env.local`, as the app README explains). Without a key, the app can't explain an idea a different way or ask you a new question. Do one practice run first. The demo PDF is a one-page textbook chapter on parallel circuits, written for this shot: it has five clear headings, which the app turns into separate concepts. It uses the same 12 V and 6 Ω example as the tutor slide in the pitch deck.

**CHOP:** This is our prototype. You add a course and attach your PDFs. Then the tutor teaches you one idea at a time. It explains it, asks you a question, and checks your answer. If you get it wrong, you get a hint. If you're still stuck, it explains it a different way and asks you a new question, so you don't move on until you actually get it. And it can read everything out loud.

**SHOT 11 — SCREEN: Aubin's voice.** The User Story Map. Scroll left to right. `PMBOK: Scope Statement`

**AUBIN:** By December 1, our first release adds answers that show the page they came from, a choice of AI models from cheapest to most expensive, and flashcards and quizzes made from your notes. In the winter, the second release adds accounts and the Pro plan, review planned around your exam dates, voice input so you can talk to it, and an iPad version.

**SHOT 12 — CAMERA: Chop.** `PMBOK: Risks`

**CHOP:** We do have limits. There are two of us, working eight to ten hours a week each. The free AI services cap how much we can use them. Scanned PDFs have no text the app can read. We've only done one interview so far, so we need more students. And course material belongs to the instructors, so your files stay on your device, and the app only sends the text it needs, after asking you first.

### Part 6 — How we'll build it (about 1:30)

**SHOT 13 — SCREEN: Aubin's voice.** VS Code with `app/src` open. Click open a few folders slowly. Don't open `.env.local`.

**AUBIN:** Here's how it's built. The app uses Next.js and React. A library called PDF.js reads your PDFs, and everything is saved on your own device. The AI keys stay on a small server, so they're never inside the app. It works with free AI services like Gemini, Groq and OpenRouter, and with Claude for the paid models. We'll package it with Electron as a desktop app for Windows and Mac.

**SHOT 14 — SCREEN: Chop's voice.** The RACI Chart PDF. `PMBOK: RACI Chart`

**CHOP:** Our RACI chart shows who does what. Whoever owns a feature is responsible for it and accountable for it. The other person gets consulted. And Dr. Maciag is kept informed.

**SHOT 15 — SCREEN: Aubin's voice.** The Gantt chart. Move the mouse along the dates as you say them. `PMBOK: Schedule`

**AUBIN:** Here's our schedule. On October 20 we test with at least five students. On October 27 we start building. On November 24 we demo at bazaar day. And on December 1 we ship the first release. Then the winter release, and a test run with fifteen students by April. The winter dates may still move.

**SHOT 16 — SCREEN: Aubin's voice.** The Kanban board on GitHub. `BAD: KPIs`

**AUBIN:** Every task is on this board, and we check it together every week. We'll call it a success if at least 85 percent of answers are accurate to the page, students get a useful answer in half the time it takes with ChatGPT, and testers rate it 70 or higher on a standard usability survey.

### Part 7 — Close (about 0:20)

**SHOT 17 — CAMERA: both of you.** GitHub link as a caption.

**AUBIN:** All our documents are on GitHub. The link is in the description.

**CHOP:** On December 1, we'll show you our first release. Thanks for watching.

---

## Before you record

- **Linda:** our documents only record one interview, Linda's. So the script says "We interviewed Linda". If you've talked to more students since, you can say "We interviewed a few students, like Linda, and they told us the same thing."
- **Name:** the script calls the project the AI Learning Environment and the app Funza. If you've settled on one name, use only that.
- **What gets sent to the AI:** the requirements say only the passage you select gets sent. The prototype sends the PDF's text when it plans lessons, but asks first. "Only sends the text it needs, after asking you first" is true of both.

## Upload checklist

1. Export at 1080p and check it's under 15 minutes.
2. Upload to YouTube as unlisted: "AI Learning Environment — ENSE 400 Vlog 1 (Izere, Kur)".
3. Description: one line about the project, plus `https://github.com/Binborg1/Final-2027`.
4. Add the link to the README **Vlogs** table and the URCourses wiki.
