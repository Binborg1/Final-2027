# Work-in-progress demo: script

**Funza Teacher Studio · v0.2 · 23 November 2026**

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
| 12. Kanban: sign-in and Make are built | Kanban, development progress | 0:30 | Aubin |
| 13. Live demo | Work-in-progress demo | 2:30 | Aubin drives, Chop narrates |
| 14. Next, and questions | Next steps | 0:20 | Chop |
| | **Total** | **9:20** | 40 seconds spare |
| 15. Backup screenshots | Only if the demo fails | | |

## Before Tuesday

- [ ] **Pick the URL.** Use the Vercel preview of `main`. Fallback: `npm run dev` on the demo laptop (see [app/README.md](../../../app/README.md)).
- [ ] **Check that AI drafting works there.** Make one quiz on the URL the night before. If it fails, check that the Gemini key is set for that environment.
- [ ] **Prepare an account for first-time setup.** Setup appears only on a teacher's first sign-in. Either use a Google account that has never signed in to Funza, or skip step 2 below and describe setup from the backup slide.
- [ ] **Keep one draft waiting for review.** If Gemini is slow on the day, open that draft instead of waiting.
- [ ] **Set up the projector laptop.** Close other tabs, mute notifications, and set the browser zoom to 110–125% so the back of the room can read it. Open the app in one tab and the slides in another.
- [ ] **Check the Wi-Fi.** Test the room's Wi-Fi or bring a phone hotspot.
- [ ] **Rehearse twice with a timer.** The demo has to fit in 2:30.

## The demo (slide 13, 2:30)

| # | Do | Say |
|---|---|---|
| 1 | Click **Continue with Google** and sign in. | "Only teachers have accounts. They sign in with Google or an emailed link." |
| 2 | First-time setup: pick Grade 10, Science, then **Science 10**. Finish. | "Every course in this list comes from the Saskatchewan curriculum we imported: all 135 Grade 10–12 curricula." |
| 3 | Home: point to **Your courses** and **Waiting for review**. Point to **Go live**, which is greyed out. | "Home has the two modes. Live mode is what we're building this week." |
| 4 | Open **Make** for Science 10. Choose **Quiz**, two chapters, and the quick prompt **Saskatchewan examples**. Open one **Adjust** row, then close it. | "The teacher says what they want in plain words, or with these chips. The detailed controls stay folded until they're needed." |
| 5 | Click **Make draft**. While it drafts, point to the stages. | "Funza drafts from the outcomes, then checks the structure, the answers and the curriculum coverage." |
| 6 | In Review, open a question. Show the answer, the marks and the outcome code. Press **R** to mark it reviewed. Point to **Approve**, which is locked. | "Nothing is approved until the teacher has looked at every part and every check passes. Approving locks a version, and only an approved version can be published." |

Close with: "Publishing to a course page and Google Classroom, and Live mode on students' phones, come in the next steps for Release 1 on 1 December."

**If something fails:** say what happened in one sentence ("the school Wi-Fi is blocking us"), go to slide 15, and walk the same steps on the screenshots. Don't debug in front of the room.

## Likely questions

| Question | Short answer |
|---|---|
| How do you know teachers want this? | We don't yet, and we say so on slide 5. The pain points are our assumptions from the requirements work. Interviews with Saskatchewan teachers are the next research step. |
| What if the AI is wrong? | Every draft is checked for structure, answers and coverage before the teacher sees it. The teacher reviews every part, and Approve stays locked until they have. In Live mode (not built yet), multiple-choice, true/false and number answers will be marked by code, not by the AI. |
| Is the curriculum data accurate? | It's imported from curriculum.gov.sk.ca and cross-checked against the Ministry's CSV files: 3,208 of 3,219 outcomes match its wording and 11 differ. No person has checked the outcomes by hand yet, and 35 of the 135 imported curricula have no outcomes in the data. |
| What about student privacy? | By design, students have no accounts: just a session code, a name and, if the teacher asks, a student number. The database is in Canada (Supabase, Canada Central) with row-level security on every table. Short answers will go to Gemini for marking with a random id and no names, so don't say all student data stays in Canada. Names and answers are deleted 30 days after a session. |
| Why not just use Kahoot or ChatGPT? | Slide 7. Those tools are good, and Kahoot and Wayground have AI too. Our focus is starting from the Saskatchewan outcomes, checking the draft, and running it live without accounts, in one tool. We did a web check, not hands-on testing, and haven't looked at Brisk. |
| How will it make money? | Our proposal: free for teachers, with a daily AI allowance, and a paid licence for departments and divisions. At school scale it costs about US$45 a month, plus US$1–3 of AI per active teacher. Prices will be set after the pilot. |
| Why Gemini? | It reads PDFs and scanned exams, and on the paid tier our prompts aren't used to improve Google's products. Development uses the free tier, so only made-up data goes there. Only the server calls it. A provider switch lets us change models with one setting. |
| What if a school network blocks it? | We'll test on a real school network before the pilot. Live mode is designed to fall back to polling every 2 seconds if real-time updates can't connect. |
| Can you finish Live mode by 1 December? | Release 1 is only the Must requirements. If time runs short, the course page and CSV export move to Release 2 first. Sign-in was finished two days early. |
| Why did you change direction so late? | Both student products depended on students uploading course material to an AI, which our course and many others treat as an academic integrity breach. We decided it was better to change than to build something users couldn't safely use. |

## Sources

- Product and requirements: [requirements and architecture](../../03_design/02_requirements_and_architecture/requirements_and_architecture.md) (v0.2, 21 November)
- Schedule: [development steps](../../04_development/01_development_steps.md)
- Screens: [UI design](../../03_design/03_ui_design/ui_design.md)
- Curriculum counts: `app/src/data/curriculum/sk-report.md`
- Competitors (web check, 23 November 2026, no hands-on testing): [Kahoot AI from PDF](https://kahoot.com/blog/2024/01/17/ai-pdf-question-generator-for-educators/), [Wayground standards](https://help.wayground.com/support/solutions/articles/158000405028-generate-standards-aligned-assessments-quizzes-with-wayground-ai), [MagicSchool standards](https://www.magicschool.ai/blog-posts/standards-aligned-curriculum), [MagicSchool with Saskatchewan outcomes](https://openpress.usask.ca/etad402teachingandcreatingwithgenai/?p=99), [Surrey Schools review](https://surreyschoolsone.ca/resources/magicschool)
- Test count: `npm test` in `app/`, run on 22 November 2026: 99 of 99 passed
