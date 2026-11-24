# Document tracker: Funza Teacher Studio

Every document the project needs for ENSE 400 (Fall 2026) and ENSE 477 (Winter 2027): where it goes, what it must contain, and how far along it is. Documents written for the earlier products are in [`archive/`](archive/) and don't count here; Teacher Studio needs its own version of each.

Update the **Status** column whenever a document changes. Write each document at the path in the **File** column (relative to `docs/`).

**Status:** Done · Draft · To do · Update (exists, but out of date) · Ongoing (added to all term) · Optional (template given, course doesn't say it's required) · ENSE 477 (due in Winter)

★ = needed for the **work-in-progress demo on 24 November**.

---

## Next up

| Date | What | Needs |
|---|---|---|
| **Tue 24 Nov** | **Work-in-progress demo** (bazaar day): 20 minutes plus 10 minutes of questions, for students, SSE faculty and mentors | Drafts of every ★ document below, and a working demo of the app |
| **Tue 1 Dec, 11:30** | **Progress vlog 2** and team retrospective; **Release 1** complete | 6.2, 8.1, a deployed Release 1 |
| Mon 7 Dec | Fall semester ends | |
| Winter 2027 | ENSE 477: dates not published yet. The team's own target for the final release is 9 April 2027 | Everything marked ENSE 477 |

The demo on 24 November must cover: project name · key stakeholders · problems and needs · unique value proposition, competitor analysis and strategy · user and business pain points · business model and goals · project charter, including core requirements and scope · milestones (user story map, Kanban, Gantt) · development progress (live demo).

---

## 1. Research: [`01_research/`](01_research/)

Course stage: Design Workshop 1 (design process, competitor analysis) and Design Workshop 2 (user and business model analysis).

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 1.1 ★ | Project ideation | `01_research/01_project_ideation.md` | The nine design-process steps: project name, key users, problems and needs (at least three), solutions and features, requirements, unique value proposition, competitive strategy, business goals and KPIs, user and business pain points | To do. Features already exist in 3.1 | |
| 1.2 ★ | Competitor analysis | `01_research/02_competitor_analysis.md` | One row per competitor: strengths, weaknesses, competing values, opportunities for Funza. Candidates: Kahoot!, Quizizz/Wayground, Mentimeter, Socrative, Google Forms quizzes, MagicSchool, Brisk, general chatbots (ChatGPT, Gemini) | To do | |
| 1.3 ★ | User analysis | `01_research/03_user_analysis.md` | One row per user group (Saskatchewan Grade 10–12 teachers, their students, department heads): user type, demographics, habits, problems and needs | To do | |
| 1.4 ★ | Business model analysis | `01_research/04_business_model_analysis.md` | One row per business model (for example free for teachers, a school or division licence, a department licence): what is offered, to whom, how (channels), why the business captures value | To do | |
| 1.5 ★ | Teacher interviews | `01_research/05_teacher_interviews.md` | Interview guide, who was interviewed (roles, not names, unless they agree), notes, findings, and the pain points each finding confirms or changes. The course stresses "YOU ≠ USER", and no teacher has been interviewed yet | To do | |
| 1.6 | Evidence for the problem | [`01_research/06_problem_evidence.md`](01_research/06_problem_evidence.md) | Published research behind each pain point (workload, adapting materials, privacy), each source's limits, which pain points still have no evidence, and what to ask in interviews | Draft (v0.1, 24 Nov, after the demo feedback). Three sources still to read (section 7) | |

## 2. Project plan: [`02_project_plan/`](02_project_plan/)

Course stage: Design Workshop 3 (project management documents, templates 01–20).

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 2.1 | Business case | `02_project_plan/01_business_case.md` | Background; business need or opportunity; options (at least "build it" and "do nothing"); cost-benefit of each option; recommendation | To do | |
| 2.2 ★ | Project charter | `02_project_plan/02_project_charter.md` | Goals; SMART objectives with KPIs; budget; sponsor; project managers; key stakeholders; milestones with dates; overall risks | To do | |
| 2.3 ★ | Stakeholder analysis | `02_project_plan/03_stakeholder_analysis.md` | Each stakeholder: name, project role, power (high/low), interest (high/low), level of support | To do | |
| 2.4 | Stakeholder management plan | `02_project_plan/04_stakeholder_management_plan.md` | Each stakeholder: who they are and how they will be managed | To do | |
| 2.5 ★ | Project requirements | in 3.2, sections 4 and 5 | Functional requirements (FR-1 to FR-32) and non-functional requirements (NFR-1 to NFR-21) | Done (in 3.2) | |
| 2.6 ★ | Project scope statement | `02_project_plan/06_project_scope_statement.md` | Deliverables as a work breakdown structure (WBS) with work packages and a description of each; exclusions; a WBS diagram | To do | |
| 2.7 | Activity-based schedule | `02_project_plan/07_activity_based_schedule.md` | Phase, then work package, then activity, each with duration, start date and end date | To do | |
| 2.8 | Milestone-based schedule | `02_project_plan/08_milestone_based_schedule.md` | Milestone and date | To do | |
| 2.9 | Roles and responsibilities | `02_project_plan/09_roles_and_responsibilities.md` | Each person: name, role, responsibilities | To do | |
| 2.10 | RACI chart | `02_project_plan/10_raci_chart.md` | Work packages against people, each cell R, A, C or I (Responsible, Accountable, Consulted, Informed) | To do | |
| 2.11 ★ | User story map | `02_project_plan/11_user_story_map.md` | Activities, then steps, then details, for the teacher (Live and Prepare) and the student, split into Release 1 and Release 2 lanes | To do | |
| 2.12 ★ | Kanban board | A new GitHub Project | Backlog, Doing, Review, Done; one issue per work package from 2.6, labelled by type and by who is accountable, in the ENSE 400 or ENSE 477 milestone. The old board's issues (#1–#18, the earlier product) were deleted on 21 Nov | To do | |
| 2.13 ★ | Gantt chart | `02_project_plan/13_gantt_chart.md` | The schedule from 2.7 drawn as a chart | To do | |
| 2.14 | Risk register | `02_project_plan/14_risk_register.md` | Risk list (probability × impact = score) and response plan (accept, mitigate, avoid or transfer; contingency and trigger). Start from 3.2, section 16 | Optional | |
| 2.15 | Communication plan | `02_project_plan/15_communication_plan.md` | Each communication: purpose and medium, audience, timing (weekly meeting, scrums, PR reviews, instructor updates) | Optional | |
| 2.16 | Documentation guidelines | [`README.md`](README.md) | Where documents are stored, how they are named, how versions are marked | Draft (in `docs/README.md`) | |
| 2.17 | Budget | `02_project_plan/17_budget.md` | Costs by phase (initiating, planning, executing, closing). Start from 3.2, section 15 | Optional | |

Change requests and the issue log (templates 17 and 18) can live in GitHub Issues with the labels `change-request` and `issue`, instead of separate files.

## 3. Design: [`03_design/`](03_design/)

Course stage: Design Workshop 4 (low- and high-fidelity prototypes) and Development Workshop 1 (system and architecture drawings).

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 3.1 | User flows and features | [`03_design/01_user_flows_and_features/`](03_design/01_user_flows_and_features/) | Live and Prepare flows, exam templates, question bank, what a student sees, use cases UC1–UC23, questions Q1–Q10. HTML, PDF and diagrams | Done (19 Nov) | |
| 3.2 | Requirements and architecture | [`03_design/02_requirements_and_architecture/`](03_design/02_requirements_and_architecture/) | Requirements, scope, the system on Vercel, Supabase and Gemini, live sessions, the AI request path, sign-in, data model, rate limits, privacy, deployment, cost, risks, Release 1 build order, open questions | Done (v0.7, 24 Nov: deleting materials and chapters, FR-3, FR-32; v0.6: the Library, FR-32; v0.5: templates built early; v0.4, 23 Nov: a live session runs the whole set on one shared timer; 60 answer saves a minute; code layout as built) | |
| 3.3 ★ | UI design | `03_design/03_ui_design/ui_design.md` | Low-fidelity wireframes and high-fidelity screens for Release 1 (teacher, Live on the projector, student phone), the shared components, and the Figma link. Markdown with images | In progress (v0.10, 24 Nov: a smaller sign-in card, Prepare first on Home, a searchable course picker; v0.9: the Library opens on course cards; v0.8: deleting materials, bringing back chapters; v0.7: the Library; v0.6: templates and Make's Format panel; v0.5: phone Submit; v0.4, 23 Nov): F · Oak picked; tokens, shared parts, the step 3 screens (sign-in with email and password, choose a new password, setup, Home, Make, review, Settings), the step 4 screens (courses, course, chapter) and the step 5 Live screens (setup, console, projector, results, sessions, student join and answer). Screenshots of the built Live screens and the student course page to come | |
| 3.4 | Access control | in 3.2, section 10 | Who can do what (teacher; student by session code; later department head) and how Supabase row-level security enforces it. ENSE 477 asks for this "role/attribute-based access control vision" | Draft (in 3.2) | |

## 4. Development: [`04_development/`](04_development/)

Course stage: Development Workshops 1–3 and the weekly scrums (from 27 October).

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 4.1 | Development steps | [`04_development/01_development_steps.md`](04_development/01_development_steps.md) | The build order from accounts to Release 1, with "done when" checks, and the Release 2 outline | Done (v0.9, 24 Nov: deleting materials and chapters; v0.8: the Library; v0.7: templates built early; v0.6: sign-in settings set, email templates wait for a custom SMTP sender; step 5 Live mode built, the load test with real phones still to run) | |
| 4.2 | Setup and run guide | [`../app/README.md`](../app/README.md) | How to install, configure and run the app | Updated 24 Nov for the Library; 23 Nov for Live mode (step 5): routes, how a session works, Realtime and the load test | |
| 4.3 | Weekly status reports | `04_development/02_status_reports/YYYY-MM-DD.md` | For each week: status (green, yellow or red) and why; what was done; what is planned; issues; changes. Bring to the scrums | Ongoing | |
| 4.4 | Code quality review report | `04_development/03_code_quality_review.md` | What was reviewed, against which checklist, what was found and fixed | ENSE 477 | |
| 4.5 | Concepts from the earlier app | [`04_development/04_concepts_from_the_earlier_app.md`](04_development/04_concepts_from_the_earlier_app.md) | The features of the removed screens and code, to implement in Teacher Studio, with where the code is in git | Done (v0.1, 21 Nov) | |
| 4.6 | Library | [`04_development/05_library.md`](04_development/05_library.md) | The Library feature: decisions, logic (what is in it, which version shows), data (no schema change; queries and row-level security), UI, code and "done when" | Done (v0.3, 24 Nov: course cards first; v0.2: deleting materials and chapters; v0.1 built the same day) | |
| 4.7 | Live history | [`04_development/06_live_history.md`](04_development/06_live_history.md) | Past live sessions: decisions, logic (what is kept and for how long, numbers that stay the same after the 30-day clean-up, ending, sessions left open, deleting, Run again), how the screens connect, UI, data (migration, functions, jobs), privacy, cases, code, tests and "done when" | Planned (v0.1, 24 Nov), not built yet | |
| 4.8 | Modify my existing material | [`04_development/07_modify_existing_material.md`](04_development/07_modify_existing_material.md) | Word and PowerPoint sources, importing a quiz to edit, copying a material or a course: decisions to make, flows, logic, data, code, "done when", order and effort | Planned (v0.1, 24 Nov), not built yet. Decisions M1–M6 need the team | |

## 5. Testing: [`05_testing/`](05_testing/)

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 5.1 | Code test plan | `05_testing/01_code_test_plan.md` | Quality standards; for each work package, its test cases and who runs them | ENSE 477 | |
| 5.2 | Code test results | `05_testing/02_code_test_results.md` | What ran, what passed and failed, and what was fixed | ENSE 477 | |
| 5.3 | Usability test plan | `05_testing/03_usability_test_plan.md` | Tasks for teachers and students, facilitator guide, SUS questionnaire. The method from the archived 20 October test can be reused | To do | |
| 5.4 | Usability test results | `05_testing/04_usability_test_results.md` | SUS scores, findings by frequency and severity, and the changes made | ENSE 477 | |

## 6. Presentations and videos: [`06_presentations/`](06_presentations/)

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 6.1 | Work-in-progress demo | `06_presentations/01_work_in_progress_demo/` | Slides (.pptx and .pdf) covering the list under "Next up", plus the demo script. **Due 24 Nov** | Presented 24 Nov (v0.7). v0.8, same day: slides 3 and 6 cite research instead of assumptions. 15 slides with speaker notes, including "What Funza does" after the problem, and the Kanban, Gantt and story map as of 24 Nov; PDF, [demo script](06_presentations/01_work_in_progress_demo/02_demo_script.md) (Science 10: upload a past quiz's format, make a 2-question quiz in it, then Live on another chapter; fast AI settings), the [past quiz to upload](06_presentations/01_work_in_progress_demo/04_demo_past_quiz_chemical_reactions.pdf) and optional [demo notes](06_presentations/01_work_in_progress_demo/03_demo_notes_uniform_motion.pdf) | |
| 6.2 | Progress vlog 2 | `06_presentations/02_progress_vlog_2/` | Script and shot list, and a link to the video on unlisted YouTube (GitHub rejects files over 100 MB). Covers the team retrospective and next steps. Check the "Vlog 2 requirements" page on UR Courses. **Due 1 Dec, 11:30** | To do | |
| 6.3 | Project poster | `06_presentations/03_project_poster/` | | ENSE 477 | |
| 6.4 | Project video demo | `06_presentations/04_project_video_demo/` | At most 10 minutes; link in the folder | ENSE 477 | |
| 6.5 | Project commercial | `06_presentations/05_project_commercial/` | At most 2 minutes; link in the folder | ENSE 477 | |
| 6.6 | Final presentation and demo | `06_presentations/06_final_presentation/` | | ENSE 477 | |

ENSE 477 also has vlogs; their number and dates are not published yet.

## 7. User guide: [`07_user_guide/`](07_user_guide/)

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 7.1 | Teacher help and training | `07_user_guide/01_teacher_guide.md` | How to set up a course, run a Live session, make and approve materials, and publish; FAQ; a one-page guide for students joining a session | ENSE 477 | |

## 8. Closing: [`08_closing/`](08_closing/)

| # | Document | File | What it must contain | Status | Owner |
|---|---|---|---|---|---|
| 8.1 | Fall retrospective | `08_closing/01_fall_retrospective.md` | After-action review: what we planned, what happened, why, what we will change in Winter. Goes with vlog 2. **Due 1 Dec** | To do | |
| 8.2 | Project experience report | `08_closing/02_project_experience_report.md` | | ENSE 477 | |

## Repository

| Item | Status |
|---|---|
| [`README.md`](../README.md): product, team, repo map, how to run | Done (21 Nov) |
| [`docs/README.md`](README.md): how documents are organized and named | Done (21 Nov) |
| `LICENSE` | To do. The team must choose. The syllabus says the team holds the IP under the licence it picks (for example proprietary, MIT, Creative Commons or GPL) |

---

## ENSE 477 grading, and the document that covers each part

From the draft rubric in the syllabus (tentative).

| Rubric item | Covered by |
|---|---|
| Business case and project charter | 2.1, 2.2 |
| Problem and requirements prerequisites | 1.1–1.5, 2.5 |
| System and architecture design pictures | 3.2 |
| Prototypes and wireframes | 3.3 |
| Authentication and security control (access control vision) | 3.4 |
| Project roadmaps (Kanban, user story map, Gantt), kept up to date | 2.11, 2.12, 2.13 |
| Vlogs and demos | 6.1, 6.2, ENSE 477 vlogs |
| GitHub kept up to date, readable and usable on delivery | `README.md`, this tracker |
| Project source code | [`app/`](../app/) |
| Code testing plan and results | 5.1, 5.2 |
| User testing plan and results | 5.3, 5.4 |
| Code quality review report | 4.4 |
| Project poster, video demo, commercial, final presentation | 6.3–6.6 |
| Customer help, user training, knowledge base | 7.1 |
| Project experience report | 8.2 |

## Course rules to keep in mind

- **Keep documents current.** The course grades a GitHub repo and roadmaps that are "continually updated". When the product changes, update the documents too.
- **Talk to real teachers.** Pain points must come from users and stakeholders, not from us.
- **Use one project name everywhere:** Funza Teacher Studio.
- **Justify decisions in our own words.** Saying that an AI tool suggested something is not enough under the course's AI-use rule.
- **Keep the instructor's material out of the repo.** Lecture slides, templates and the course page stay on our own machines (in the git-ignored `local/` folder).
