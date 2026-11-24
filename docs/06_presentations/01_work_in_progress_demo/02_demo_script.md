# Work-in-progress demo: script

**Funza Teacher Studio · v0.8 · 24 November 2026**

*Changed in v0.8, after the demo: slides 3 and 6 and their notes cite research instead of our assumptions ([evidence](../../01_research/06_problem_evidence.md)). The deck as presented is v0.7, in git at `4fc7633`. Changed in v0.7: the deck has 15 slides. Slide 4 is new and says what Funza does (Prepare and Live) right after the problem. The Kanban, Gantt, story map and timeline match the work as of 24 November, and the demo slide's notes follow the demo below.*

The script for the ENSE 400 work-in-progress demo on **Tuesday 24 November 2026**: 10 minutes, then 5 minutes of questions. The slides are [`01_work_in_progress_demo.pptx`](01_work_in_progress_demo.pptx) (PDF: [`01_work_in_progress_demo.pdf`](01_work_in_progress_demo.pdf)), and each slide's talk track is in its speaker notes.

> The [document tracker](../../document_tracker.md) says "20 minutes plus 10 minutes of questions". The UR Courses brief says 10 plus 5, and this script follows the brief.

## Running order

The speaker split is a suggestion. Swap it as you like, but change speakers only at a section break.

| Slide | Covers (from the brief) | Time | Speaker |
|---|---|---|---|
| 1. Funza Teacher Studio | Project name | 0:20 | Chop |
| 2. From a student study app to a teacher studio | Work from the confirmed idea to now | 0:30 | Chop |
| 3. Teachers plan and mark on their own time | Problems and needs | 0:35 | Chop |
| 4. What Funza does: Prepare before class, Live in class | The solution: what the product does | 0:40 | Chop |
| 5. Who has a stake in Funza | Key stakeholders | 0:30 | Chop |
| 6. Pain points for teachers and for schools | User and business pain points | 0:30 | Chop |
| 7. Funza drafts from the curriculum; the teacher approves | UVP and strategy | 0:25 | Chop |
| 8. What competitors do well, and the gap we fill | Competitor analysis | 0:35 | Chop |
| 9. Free for teachers first; schools and divisions pay later | Business model | 0:35 | Aubin |
| 10. Project charter: requirements and scope | Charter, core requirements, scope | 0:30 | Aubin |
| 11. Milestones | Gantt | 0:30 | Aubin |
| 12. User story map | USM | 0:30 | Aubin |
| 13. Kanban: Prepare and Live are built; phone tests are next | Kanban, development progress | 0:30 | Aubin |
| 14. Live demo | Work-in-progress demo | 2:50 | Aubin drives, Chop narrates |
| 15. Next, and questions | Next steps | 0:20 | Chop |
| | **Total** | **9:50** | 10 seconds spare |

## The course and files to use

- **Course:** Science 10. Everyone remembers speed = distance ÷ time, and the deck and Figma screens already use Science 10.
- **The quiz Funza makes:** chapter **Force and Motion in Our World**.
- **The live test:** chapter **Climate and Ecosystem Dynamics**, a different topic with no formulas, so every question reads cleanly on a phone.
- **The past quiz to upload:** [`04_demo_past_quiz_chemical_reactions.pdf`](04_demo_past_quiz_chemical_reactions.pdf) (source: [`04_demo_past_quiz_chemical_reactions.md`](04_demo_past_quiz_chemical_reactions.md)). It's our own 2-question Science 10 quiz on Chemical Reactions with a clear format: a name, block and date line, then **Part A: Multiple choice** (1 mark) and **Part B: Show your work** (a calculation, 2 marks). Funza copies the format, not the topic. Before the demo, copy it to the desktop as **Quiz 4 Chemical Reactions.pdf**.
- Optional: [`03_demo_notes_uniform_motion.pdf`](03_demo_notes_uniform_motion.pdf), notes on uniform motion, if you also want to attach notes in Make with **Attach a source**.

## Demo settings (switched on 24 November)

These are on Vercel (Production and Preview) and in `app/.env.local`, so the deployed site and the `npm run dev` fallback both answer fast:

| Setting | Demo value | What it does | After the demo |
|---|---|---|---|
| `FUNZA_AI_MODEL` | `gemini-3.5-flash` | A faster Gemini model | Keep it, or delete it to go back to `gemini-2.5-flash` |
| `FUNZA_AI_THINKING` | `minimal` | Gemini skips its thinking step, so it answers in seconds | Keep it with the model above |
| `FUNZA_AI_DAILY_LIMIT` | `100000` | The daily allowance of 40 Funza actions is effectively off | Delete it: back to 40 a day |

Timed on 24 November with the app's own prompts and checks:

| Task | Before (`gemini-2.5-flash`) | Now |
|---|---|---|
| Reading the format of the 2-question past quiz | not timed | about 2 s |
| A 2-question quiz in that format | not timed | about 3 s |
| Live: suggest questions for a chapter | not timed | 7–11 s |
| A 2-question quiz from the notes | not timed | 3–4 s |
| Live: suggest 8 questions from the notes | about 29 s, then cut off ("The AI reply was cut off") | 7–9 s |
| A 12-question quiz | about 35 s | 10–16 s |
| Notes | about 31 s, then cut off | 6–8 s |
| Marking 3 short answers | cut off: Funza couldn't mark them | 2 s |

The old model spent most of each reply's length limit thinking, so long replies were cut off. The server now also asks Gemini once more, unseen, if a reply comes back unreadable (about 1 reply in 12 in testing). Funza is also told to write plain text, because the app doesn't display LaTeX: one early Chemical Reactions run had formulas in LaTeX, and none did after the change.

## Before the demo

- [ ] **Copy the past quiz** to the desktop as **Quiz 4 Chemical Reactions.pdf**.
- [ ] **Rehearse the whole demo below once** with the demo account, timed, with two real phones: one on the room's Wi-Fi and one on mobile data.
- [ ] **Get a clean account for the real run.** After the rehearsal, ask Claude for a fresh demo account, so the real run starts with no courses, templates or sessions.
- [ ] **Sign in on the projector laptop** at <https://funza-rose.vercel.app> with **email and password**, and stay signed in.
- [ ] **Line up two people to join** (Chop's phone and one friend), so the lobby never sits empty.
- [ ] **Set up the projector laptop.** Close other tabs, mute notifications, and set the browser zoom to 110–125%. Keep the slides in another tab.
- [ ] **Check the Wi-Fi**, or bring a phone hotspot.
- [ ] **Use made-up names and answers.** The site uses the development database.

## The demo (slide 14)

Aubin drives and Chop narrates. The times are when each step should be finished. The whole run takes about 3:10, against 2:50 on the slide plan: take 20 seconds from the slides, or skip **See results** at the end.

| # | By | Do | Say |
|---|---|---|---|
| 1 | 0:15 | On Home, click **Add a course**. Type **Science 10** in the search box, choose it, click **Add course**, then **Open course**. Point at the four chapters. | "A teacher picks the course they teach. The chapters come straight from the Saskatchewan curriculum." |
| 2 | 1:05 | Open **Make**. Choose **Quiz** and the chapter **Force and Motion in Our World**. In **Format**, click **Template**, then **New template**. Drop **Quiz 4 Chemical Reactions.pdf** in the box and click **Read the format**. It takes about 2 seconds. Point at the two parts Funza found, then click **Save template**. | "Teachers already have their own quiz format. They upload an old quiz once, and Funza learns its layout: the parts, the question types and the marks." |
| 3 | 1:15 | Back in Make, the new template is chosen. Click **Make draft**. It takes about 3 seconds. | "Funza writes a new quiz on Force and Motion in the teacher's own format." |
| 4 | 1:40 | In Review, open the calculation and point at the answer and the outcome code. Click **I’ve checked this** on both questions, then **Approve** and **Approve version 1**. | "Nothing is approved until the teacher has checked every part." |
| 5 | 2:25 | Open **Live** and click **Go live**. Choose **Science 10** and the chapter **Climate and Ecosystem Dynamics**. Click **Suggest 8 questions** (about 10 seconds). Untick all but 2: one multiple choice and one true or false. Switch off **Student number**. Click **Open the lobby**, then **Open projector view**, and ask the room to scan the QR code. | "In class, the teacher picks a topic and Funza suggests questions. Students join on their phones: no account, no app." |
| 6 | 3:10 | When a few names are in, click **Start answering**. After about 20 seconds click **End early** and confirm. On **Check marks**, click **Reveal**, then **See results**. | "Multiple choice and true or false are marked by code. Each phone sees its own result, the projector shows the class, and the teacher sees what was missed most." |

Close with: "The course page and the 40-phone test are what's left before Release 1 on 1 December."

**If something fails.** Say what happened in one sentence, then:

- **Read the format or Make draft fails:** click it once more. If it fails again, set the quiz up by hand: **Format** → **Adjust**, 1 multiple choice and 1 calculation, every other type 0.
- **Suggest 8 questions fails:** click it once more. If it fails again, open the quiz you just approved and click **Run live**: its 2 questions are ready.
- **Phones can't join:** show the lobby and the projector view, and say a real-phone test is next on the Kanban.
- **The site is down:** open the screenshots in [`docs/03_design/03_ui_design/diagrams/`](../../03_design/03_ui_design/diagrams/) (`09_built_sign_in.png` to `13_built_review_phone.png`). Don't debug in front of the room.

## Likely questions

| Question | Short answer |
|---|---|
| How do you know teachers want this? | The problem is documented: educators in one Saskatchewan division reported 7.1 hours of planning and 4.8 of assessment a week outside the school day, and too much marking is the top stressor in Alberta. Those surveys aren't high school only, so whether teachers want *this* product is what our interviews will test. Points without a number on slide 6 are ours. |
| What if the AI is wrong? | Every draft is checked for structure, answers and coverage before the teacher sees it. The teacher reviews every part, and Approve stays locked until they have. In Live mode, multiple-choice, true/false and number answers are marked by code, not by the AI. Funza marks short answers and the teacher can change any mark. |
| Is the curriculum data accurate? | It's imported from curriculum.gov.sk.ca and cross-checked against the Ministry's CSV files: 3,208 of 3,219 outcomes match its wording and 11 differ. No person has checked the outcomes by hand yet, and 35 of the 135 imported curricula have no outcomes in the data. |
| What about student privacy? | By design, students have no accounts: just a session code, a name and, if the teacher asks, a student number. The database is in Canada (Supabase, Canada Central) with row-level security on every table. Short answers go to Gemini for marking with a random id and no names, so don't say all student data stays in Canada (the sign-in page currently says "Your data stays in Canada"). Names and answers are deleted 30 days after a session. |
| Why not just use Kahoot or ChatGPT? | Slide 8. Those tools are good, and Kahoot, Socrative and Quizlet have AI too. Socrative is strong live, but its preparation stops at quiz questions. Our focus is starting from the Saskatchewan outcomes, checking the draft, and running it live without accounts, in one tool. ChatGPT and Gemini are a chat with one person: we found no interactive layer where a teacher runs something live with students. Say "we found none", because Google is adding teacher tools to Classroom. We did a web check, not hands-on testing, and haven't looked at Brisk. |
| How will it make money? | Our proposal: free for teachers, with a daily AI allowance, and a paid licence for departments and divisions. At school scale it costs about US$45 a month, plus US$1–3 of AI per active teacher. Prices will be set after the pilot. |
| Why Gemini? | It reads PDFs and scanned exams, and on the paid tier our prompts aren't used to improve Google's products. Development uses the free tier, so only made-up data goes there. Only the server calls it. The model is one setting: the demo uses Gemini 3.5 Flash with minimal thinking, so drafts come back in seconds. |
| What if a school network blocks it? | We'll test on a real school network before the pilot. If real-time updates can't connect, Live mode asks the server every 2 seconds instead. |
| Will Release 1 be ready by 1 December? | Courses, the question bank and Live mode were merged on 23 November, ahead of the 24–28 November plan. Left: phone testing, the course page, and a separate production database. The course page moves to Release 2 first if time runs short. Templates, the Library and deleting materials were built on 24 November. |
| Why did you change direction so late? | Both student products depended on students uploading course material to an AI, which our course and many others treat as an academic integrity breach. We decided it was better to change than to build something users couldn't safely use. |

## Sources

- Product and requirements: [requirements and architecture](../../03_design/02_requirements_and_architecture/requirements_and_architecture.md) (v0.2, 21 November)
- Schedule: [development steps](../../04_development/01_development_steps.md)
- Screens: [UI design](../../03_design/03_ui_design/ui_design.md)
- Curriculum counts: `app/src/data/curriculum/sk-report.md`
- Problem and pain points: [evidence for the problem](../../01_research/06_problem_evidence.md)
- Competitors (web check, 23–24 November 2026, no hands-on testing): [Gemini in Classroom](https://blog.google/products-and-platforms/products/education/classroom-ai-features/), [Google's plans for Classroom](https://techcrunch.com/2025/06/30/google-embraces-ai-in-the-classroom-with-new-gemini-tools-for-educators-chatbots-for-students-and-more), [Kahoot AI from PDF](https://kahoot.com/blog/2024/01/17/ai-pdf-question-generator-for-educators/), [Socrative AI question generation](https://help.socrative.com/en/articles/8732134-ai-question-generation), [Quizlet Live](https://www.educatorstechnology.com/2023/05/what-is-quizlet-live-and-how-to-use-it.html), [Quizlet for teachers](https://www.techlearning.com/how-to/what-is-quizlet-and-how-can-i-teach-with-it)
- Test count: `npm test` on `main` at `998985e`, run on 24 November 2026: 274 of 274 passed. Database checks: 159 planned in `app/db/supabase/tests/database/`, run by CI; 19 tables, each with row-level security (Supabase table list, 24 November)
- Live site: `/sign-in`, `/join` and `/api/health` answered on 24 November 2026, and the health check reached the database
- Live mode: two sessions in the development database ran to Reveal on 24 November 2026, each with one student. No session with several phones is recorded yet, so the slides say Live mode "ran end to end" and list the real-phone test as Doing
- Kanban (slide 13): the work as of 24 November 2026, from the development steps and git history (PRs #24–#33; templates and the Library were pushed straight to `main` on 24 November). The GitHub project "Final-2027 Kanban" exists but has no issues yet
- AI timings: the app's own prompts and checks, run against the Gemini API on 24 November 2026 (reading the past quiz's format and a quiz in it, Live suggestions for three Science 10 chapters, a 2-question quiz from the demo notes, a 12-question quiz, notes, marking 3 short answers), 2–4 runs each
