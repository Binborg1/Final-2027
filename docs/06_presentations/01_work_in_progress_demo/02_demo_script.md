# Work-in-progress demo: script

**Funza Teacher Studio · v0.5 · 24 November 2026**

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

## Before Tuesday

- [ ] **Open the site.** Use <https://funza-rose.vercel.app>. Fallback: `npm run dev` on the demo laptop (see [app/README.md](../../../app/README.md)).
- [ ] **Check that AI drafting works there.** Make one quiz on the live site before the demo. If it fails, check that the Gemini key is set for Vercel's Production environment, not only Preview.
- [ ] **Finish first-time setup beforehand.** Sign in with the demo Google account, add Science 10, and sign out.
- [ ] **Approve one short quiz beforehand.** Three or four multiple-choice questions, so the live run needs no AI marking.
- [ ] **Run one full live session on real phones first**, including the lobby, **Reveal** and a phone on mobile data. Live mode has passed automated tests but has not been recorded as run on real phones. If it fails, stop the demo after step 4.
- [ ] **Use made-up names and answers.** The site uses the development database and, unless the production key is set, Gemini's free tier.
- [ ] **Keep one draft waiting for review.** If Gemini is slow on the day, open that draft instead of waiting.
- [ ] **Set up the projector laptop.** Close other tabs, mute notifications, and set the browser zoom to 110–125% so the back of the room can read it. Open the app in one tab and the slides in another.
- [ ] **Check the Wi-Fi.** Test the room's Wi-Fi or bring a phone hotspot.
- [ ] **Rehearse twice with a timer.** The demo has to fit in 2:50.

## The demo (slide 13, 2:50)

Slide 13's QR code opens the website (the sign-in page). To join the live session in step 5, people scan the QR code in the lobby instead.

| # | Do | Say |
|---|---|---|
| 1 | Open `funza-rose.vercel.app`, click **Continue with Google** and sign in. | "Only teachers have accounts. They sign in with Google, or an email and password." |
| 2 | Open **Make** for Science 10. Choose **Quiz** and two chapters, and type "Use Saskatchewan examples" in the request box. | "Every course here comes from the Saskatchewan curriculum we imported. The teacher says what they want in plain words." |
| 3 | Click **Make draft**. While it drafts, point to the stages. | "Funza drafts from the outcomes, then checks the structure, the answers and the curriculum coverage." |
| 4 | In Review, open a question. Show the answer, the marks and the outcome code. Point to **Approve**, which is locked. | "Nothing is approved until the teacher has looked at every part and every check passes. Approving locks a version." |
| 5 | Open the quiz you approved beforehand. Click **Run live**, **Open the lobby**, then **Open projector view**. Ask two or three people to scan the QR code. | "Students join with the code and a name. No account, no app." |
| 6 | Click **Start answering**. After about 20 seconds click **End early**, then **Reveal**. Finish on **See results** if there is time. | "Each phone sees its own result. The projector shows the correct answers, and the teacher sees what the class missed most." |

Close with: "The course page and the 40-phone test are what's left before Release 1 on 1 December."

**If something fails:** say what happened in one sentence ("the school Wi-Fi is blocking us"), and open the screenshots in [`docs/03_design/03_ui_design/diagrams/`](../../03_design/03_ui_design/diagrams/) (`09_built_sign_in.png` to `13_built_review_phone.png`). There are none of the Live screens. Keep that folder open in another window, because the deck no longer has a backup slide. Don't debug in front of the room.

## Likely questions

| Question | Short answer |
|---|---|
| How do you know teachers want this? | We don't yet, and we say so on slide 5. The pain points are our assumptions from the requirements work. Interviews with Saskatchewan teachers are the next research step. |
| What if the AI is wrong? | Every draft is checked for structure, answers and coverage before the teacher sees it. The teacher reviews every part, and Approve stays locked until they have. In Live mode, multiple-choice, true/false and number answers are marked by code, not by the AI. Funza marks short answers and the teacher can change any mark. |
| Is the curriculum data accurate? | It's imported from curriculum.gov.sk.ca and cross-checked against the Ministry's CSV files: 3,208 of 3,219 outcomes match its wording and 11 differ. No person has checked the outcomes by hand yet, and 35 of the 135 imported curricula have no outcomes in the data. |
| What about student privacy? | By design, students have no accounts: just a session code, a name and, if the teacher asks, a student number. The database is in Canada (Supabase, Canada Central) with row-level security on every table. Short answers go to Gemini for marking with a random id and no names, so don't say all student data stays in Canada (the sign-in page currently says "Your data stays in Canada"). Names and answers are deleted 30 days after a session. |
| Why not just use Kahoot or ChatGPT? | Slide 7. Those tools are good, and Kahoot and Wayground have AI too. Our focus is starting from the Saskatchewan outcomes, checking the draft, and running it live without accounts, in one tool. ChatGPT and Gemini are a chat with one person: we found no interactive layer where a teacher runs something live with students. Say "we found none", because Google is adding teacher tools to Classroom. We did a web check, not hands-on testing, and haven't looked at Brisk. |
| How will it make money? | Our proposal: free for teachers, with a daily AI allowance, and a paid licence for departments and divisions. At school scale it costs about US$45 a month, plus US$1–3 of AI per active teacher. Prices will be set after the pilot. |
| Why Gemini? | It reads PDFs and scanned exams, and on the paid tier our prompts aren't used to improve Google's products. Development uses the free tier, so only made-up data goes there. Only the server calls it. A provider switch lets us change models with one setting. |
| What if a school network blocks it? | We'll test on a real school network before the pilot. If real-time updates can't connect, Live mode asks the server every 2 seconds instead. |
| Will Release 1 be ready by 1 December? | Courses, the question bank and Live mode were merged on 23 November, ahead of the 24–28 November plan. Left: phone testing, the course page, and a separate production database. The course page moves to Release 2 first if time runs short. The built-in templates (FR-19) are also not built yet. |
| Why did you change direction so late? | Both student products depended on students uploading course material to an AI, which our course and many others treat as an academic integrity breach. We decided it was better to change than to build something users couldn't safely use. |

## Sources

- Product and requirements: [requirements and architecture](../../03_design/02_requirements_and_architecture/requirements_and_architecture.md) (v0.2, 21 November)
- Schedule: [development steps](../../04_development/01_development_steps.md)
- Screens: [UI design](../../03_design/03_ui_design/ui_design.md)
- Curriculum counts: `app/src/data/curriculum/sk-report.md`
- Competitors (web check, 23–24 November 2026, no hands-on testing): [Gemini in Classroom](https://blog.google/products-and-platforms/products/education/classroom-ai-features/), [Google's plans for Classroom](https://techcrunch.com/2025/06/30/google-embraces-ai-in-the-classroom-with-new-gemini-tools-for-educators-chatbots-for-students-and-more), [Kahoot AI from PDF](https://kahoot.com/blog/2024/01/17/ai-pdf-question-generator-for-educators/), [Wayground standards](https://help.wayground.com/support/solutions/articles/158000405028-generate-standards-aligned-assessments-quizzes-with-wayground-ai), [MagicSchool standards](https://www.magicschool.ai/blog-posts/standards-aligned-curriculum), [MagicSchool with Saskatchewan outcomes](https://openpress.usask.ca/etad402teachingandcreatingwithgenai/?p=99), [Surrey Schools review](https://surreyschoolsone.ca/resources/magicschool)
- Test count: `npm test` on a clean copy of `main` at `81380f2`, run on 24 November 2026: 215 of 215 passed. Database checks: 136 planned in `app/db/supabase/tests/`, run by CI
- Live site: `/sign-in`, `/join` and `/api/health` answered on 24 November 2026; signed-in pages, AI drafting and a live session were not checked for this script
