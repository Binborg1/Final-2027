# Work-in-progress demo: script

**Funza Teacher Studio · v0.6 · 24 November 2026**

The script for the ENSE 400 work-in-progress demo on **Tuesday 24 November 2026**: 10 minutes, then 5 minutes of questions. The slides are [`01_work_in_progress_demo.pptx`](01_work_in_progress_demo.pptx) (PDF: [`01_work_in_progress_demo.pdf`](01_work_in_progress_demo.pdf)), and each slide's talk track is in its speaker notes.

> The [document tracker](../../document_tracker.md) says "20 minutes plus 10 minutes of questions". The UR Courses brief says 10 plus 5, and this script follows the brief.

## Running order

The speaker split is a suggestion. Swap it as you like, but change speakers only at a section break.

| Slide | Covers (from the brief) | Time | Speaker |
|---|---|---|---|
| 1. Funza Teacher Studio | Project name | 0:20 | Chop |
| 2. From a student study app to a teacher studio | Work from the confirmed idea to now | 0:40 | Chop |
| 3. Teachers spend their evenings on curriculum work | Problems and needs | 0:35 | Chop |
| 4. Who has a stake in Funza | Key stakeholders | 0:30 | Chop |
| 5. Pain points for teachers and for schools | User and business pain points | 0:35 | Chop |
| 6. Funza drafts from the curriculum; the teacher approves | UVP and strategy | 0:35 | Chop |
| 7. What competitors do well, and the gap we fill | Competitor analysis | 0:35 | Chop |
| 8. Free for teachers first; schools and divisions pay later | Business model and goals | 0:35 | Aubin |
| 9. Project charter: requirements and scope | Charter, core requirements, scope | 0:35 | Aubin |
| 10. Milestones | Gantt | 0:30 | Aubin |
| 11. User story map | USM | 0:30 | Aubin |
| 12. Kanban: Prepare and Live are online; phone tests are next | Kanban, development progress | 0:30 | Aubin |
| 13. Live demo | Work-in-progress demo | 2:50 | Aubin drives, Chop narrates |
| 14. Next, and questions | Next steps | 0:20 | Chop |
| | **Total** | **9:40** | 20 seconds spare |

## The course to use

Use **Science 10**, and inside it the chapter **Force and Motion in Our World** (outcome SCI10-FM2, uniform motion).

- Everyone in the room remembers speed = distance ÷ time, so nobody gets lost in the content.
- The questions show what Funza checks: a number question has an answer that code verifies, not the AI.
- The deck and the Figma screens already use Science 10 · Force and Motion, so the demo matches the slides.
- Science 10 adds four chapters straight from the Saskatchewan curriculum, which is easy to point at.

The notes to upload are [`03_demo_notes_uniform_motion.pdf`](03_demo_notes_uniform_motion.pdf): 2 pages of our own notes on uniform motion, with Saskatchewan examples (a grain truck, Highway 1, the Wascana trail). Source: [`03_demo_notes_uniform_motion.md`](03_demo_notes_uniform_motion.md). Before the demo, copy the PDF to the desktop as **Uniform motion notes.pdf**: the file name is what the screen shows.

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
| A 2-question quiz from the notes | not timed | 3–4 s |
| Live: suggest 8 questions from the notes | about 29 s, then cut off ("The AI reply was cut off") | 7–9 s |
| A 12-question quiz | about 35 s | 10–16 s |
| Notes | about 31 s, then cut off | 6–8 s |
| Marking 3 short answers | cut off: Funza couldn't mark them | 2 s |

The old model spent most of each reply's length limit thinking, so long replies were cut off. The server now also asks Gemini once more, unseen, if a reply comes back unreadable (about 1 reply in 12 in testing).

## Before the demo

- [ ] **Copy the notes** to the desktop as **Uniform motion notes.pdf**.
- [ ] **Make the 2-question template once.** Sign in with the demo account. Open **Make**, choose **Quiz**, open **Format** and choose **Adjust**. Set **Multiple choice** to 1 and **Calculation** to 1, and every other type to 0. Click **Save these settings as a template** and name it **Class check**. A template belongs to the account, not a course, so it stays when you delete the course in the last step.
- [ ] **Rehearse the whole demo below once**, timed, with two real phones: one on the room's Wi-Fi and one on mobile data.
- [ ] **Reset for the real run.** Open Science 10, then **Delete this course** in its settings, so that adding the course on stage works again. "Add a course" lists only courses you don't already have.
- [ ] **Line up two people to join** (Chop's phone and one friend), so the lobby never sits empty.
- [ ] **Set up the projector laptop.** Close other tabs, mute notifications, set the browser zoom to 110–125%, and sign in to <https://funza-rose.vercel.app> before the session starts. Keep the slides in another tab.
- [ ] **Check the Wi-Fi**, or bring a phone hotspot.
- [ ] **Use made-up names and answers.** The site uses the development database.

## The demo (slide 13, 2:50)

Aubin drives and Chop narrates. The times are when each step should be finished.

| # | By | Do | Say |
|---|---|---|---|
| 1 | 0:15 | Open **Courses**, click **Add a course**, choose Grade 10 and **Science 10**, and add it. Point at the four chapters. | "A teacher picks the course they teach. Its chapters come straight from the Saskatchewan curriculum." |
| 2 | 0:35 | Open **Force and Motion in Our World**. Under **Sources**, attach **Uniform motion notes.pdf**. | "Teachers already have notes. They attach them to the chapter once." |
| 3 | 1:00 | Click **Make something**. Choose **Quiz**, click **Use Uniform motion notes.pdf**, then in **Format** choose **Template** and **Class check**. Click **Make draft**. It takes about 4 seconds. | "Funza drafts from the curriculum outcomes and the teacher's own notes, in the teacher's own format." |
| 4 | 1:25 | In Review, open the calculation and point at the answer and the outcome code. Click **I’ve checked this** on both questions, then **Approve** and **Approve version 1**. | "Nothing is approved until the teacher has checked every part. Approving saves the questions to the chapter's question bank." |
| 5 | 1:55 | Click **Run live**. Under **Students type**, switch off **Student number** so joining is quicker. Click **Open the lobby**, then **Open projector view**. Ask the room to scan the QR code. | "Students join on their phones with the code and a name. No account, no app." |
| 6 | 2:40 | When a few names are in, click **Start answering**. After about 20 seconds click **End early** and confirm. On **Check marks**, click **Reveal**, then **See results**. | "Multiple choice and number answers are marked by code. Each phone sees its own result, the projector shows the class, and the teacher sees what was missed most." |

Close with: "The course page and the 40-phone test are what's left before Release 1 on 1 December."

**If something fails.** Say what happened in one sentence, then:

- **Make draft fails or hangs:** click **Make draft** once more. If it fails again, click **Go live** on the chapter page, choose **Upload a PDF or notes**, click **Suggest 8 questions**, untick all but 2, and carry on from step 5.
- **Phones can't join:** show the lobby and the projector view, and say a real-phone test is next on the Kanban.
- **The site is down:** open the screenshots in [`docs/03_design/03_ui_design/diagrams/`](../../03_design/03_ui_design/diagrams/) (`09_built_sign_in.png` to `13_built_review_phone.png`). Don't debug in front of the room.

## Likely questions

| Question | Short answer |
|---|---|
| How do you know teachers want this? | We don't yet, and we say so on slide 5. The pain points are our assumptions from the requirements work. Interviews with Saskatchewan teachers are the next research step. |
| What if the AI is wrong? | Every draft is checked for structure, answers and coverage before the teacher sees it. The teacher reviews every part, and Approve stays locked until they have. In Live mode, multiple-choice, true/false and number answers are marked by code, not by the AI. Funza marks short answers and the teacher can change any mark. |
| Is the curriculum data accurate? | It's imported from curriculum.gov.sk.ca and cross-checked against the Ministry's CSV files: 3,208 of 3,219 outcomes match its wording and 11 differ. No person has checked the outcomes by hand yet, and 35 of the 135 imported curricula have no outcomes in the data. |
| What about student privacy? | By design, students have no accounts: just a session code, a name and, if the teacher asks, a student number. The database is in Canada (Supabase, Canada Central) with row-level security on every table. Short answers go to Gemini for marking with a random id and no names, so don't say all student data stays in Canada (the sign-in page currently says "Your data stays in Canada"). Names and answers are deleted 30 days after a session. |
| Why not just use Kahoot or ChatGPT? | Slide 7. Those tools are good, and Kahoot and Wayground have AI too. Our focus is starting from the Saskatchewan outcomes, checking the draft, and running it live without accounts, in one tool. ChatGPT and Gemini are a chat with one person: we found no interactive layer where a teacher runs something live with students. Say "we found none", because Google is adding teacher tools to Classroom. We did a web check, not hands-on testing, and haven't looked at Brisk. |
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
- Competitors (web check, 23–24 November 2026, no hands-on testing): [Gemini in Classroom](https://blog.google/products-and-platforms/products/education/classroom-ai-features/), [Google's plans for Classroom](https://techcrunch.com/2025/06/30/google-embraces-ai-in-the-classroom-with-new-gemini-tools-for-educators-chatbots-for-students-and-more), [Kahoot AI from PDF](https://kahoot.com/blog/2024/01/17/ai-pdf-question-generator-for-educators/), [Wayground standards](https://help.wayground.com/support/solutions/articles/158000405028-generate-standards-aligned-assessments-quizzes-with-wayground-ai), [MagicSchool standards](https://www.magicschool.ai/blog-posts/standards-aligned-curriculum), [MagicSchool with Saskatchewan outcomes](https://openpress.usask.ca/etad402teachingandcreatingwithgenai/?p=99), [Surrey Schools review](https://surreyschoolsone.ca/resources/magicschool)
- Test count: `npm test` on a clean copy of `main` at `81380f2`, run on 24 November 2026: 215 of 215 passed. Database checks: 136 planned in `app/db/supabase/tests/`, run by CI
- Live site: `/sign-in`, `/join` and `/api/health` answered on 24 November 2026; signed-in pages, AI drafting and a live session were not checked for this script
- AI timings: the app's own prompts and checks, run against the Gemini API on 24 November 2026 (Live suggestions and a 2-question quiz from the demo notes, a 12-question quiz, notes, marking 3 short answers), 2–4 runs each
