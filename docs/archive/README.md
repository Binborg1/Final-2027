# Archive: earlier products

These are the documents for the two products the team worked on before Funza Teacher Studio. They are kept as they were submitted, so the history of the project can be shown. **They do not describe what is being built now.** For that, start at the [repo README](../../README.md) and the [document tracker](../document_tracker.md).

The files have new folder and file names, but their contents are unchanged. Paths written inside them (for example `docs/04_workshop_3/`) refer to the repo's old layout; the table at the end maps old names to new ones.

## 1. AI Learning Environment (September–October 2026)

A study app for **university students**: a PDF reader with AI explanations tied to the page, flashcards, quizzes, a model picker and a paid Pro plan, planned as an Electron desktop app. It was chosen on 15 September from three ideas (the others were uofrEats, a campus food app, and AI-assisted drones).

**Why it was dropped:** the app depended on students uploading their lecture notes and slides to an AI. Many courses treat that as an academic integrity and copyright breach (our own course outline forbids it), so the product would have put its users at risk. The team moved to a tool for teachers instead.

| Folder | What it is | Course stage | Date |
|---|---|---|---|
| [`01_ideation_and_competitor_analysis/`](01_ai_learning_environment/01_ideation_and_competitor_analysis/) | Project ideation table (users, problems, features, requirements) and competitor analysis of AI study tools | Design Workshop 1 | Sept 2026 |
| [`02_three_idea_pitch/`](01_ai_learning_environment/02_three_idea_pitch/) | Pitch deck comparing the three ideas: uofrEats, AI Learning Environment, AI drones | Project pitches | 15 Sept 2026 |
| [`03_user_and_business_model_analysis/`](01_ai_learning_environment/03_user_and_business_model_analysis/) | User analysis of university students; three business model options | Design Workshop 2 | Sept 2026 |
| [`04_project_plan/`](01_ai_learning_environment/04_project_plan/) | Business case, charter, stakeholders, requirements, scope, schedules, roles, RACI, user story map, Gantt chart | Design Workshop 3 | 6 Oct 2026 |
| [`05_final_pitch/`](01_ai_learning_environment/05_final_pitch/) | Five-minute final pitch deck, given to mentors at the Cultivator startup incubator ("Cultivator HQ") | Final pitch | 13 Oct 2026 |
| [`06_progress_vlog_1/`](01_ai_learning_environment/06_progress_vlog_1/) | Vlog 1 script and shot list, and the video (it demos the early student tutor prototype) | Vlog 1 | 13 Oct 2026 |

## 2. Funza student tutor (October 2026)

A prototype that taught concepts from lecture PDFs one at a time, with hints, a talking brain mascot, voice and a sample Computer Networks course. It was tested with classmates at the usability evaluation on 20 October.

**Why it was dropped:** it was still a student tool built on uploaded course material, with the same academic integrity problem.

| Folder | What it is | Course stage | Date |
|---|---|---|---|
| [`01_usability_test/`](02_funza_student_tutor/01_usability_test/) | Low-fidelity wireframes, facilitator session plan, SUS questionnaire, the screens as SVGs for [Figma](https://www.figma.com/design/2EKJLy3nigXgurkl4vLqE2), and the questionnaire QR sign | Design Workshop 5 (usability evaluation) | 19–20 Oct 2026 |

The SUS questionnaire and the session method can be reused for Teacher Studio's own usability test.

## Old names to new names

| Old folder | New folder |
|---|---|
| `docs/01_workshop_1/` | `01_ai_learning_environment/01_ideation_and_competitor_analysis/` |
| `docs/02_workshop_2/` | `01_ai_learning_environment/03_user_and_business_model_analysis/` |
| `docs/03_pitch/01_three_project_pitches.*` | `01_ai_learning_environment/02_three_idea_pitch/01_three_idea_pitch_deck.*` |
| `docs/03_pitch/02_final_pitch_cultivator_hq.*` | `01_ai_learning_environment/05_final_pitch/01_final_pitch_deck.*` |
| `docs/04_workshop_3/` | `01_ai_learning_environment/04_project_plan/` |
| `docs/05_vlog_1/`, `vlog1.mp4` | `01_ai_learning_environment/06_progress_vlog_1/` |
| `docs/06_usability_bazaar/` | `02_funza_student_tutor/01_usability_test/` |
| `docs/07_teacher_studio/` | moved to [`docs/03_design/01_user_flows_and_features/`](../03_design/01_user_flows_and_features/) (current, not archived) |
| `docs/00_lectures/` | removed from the repo: the instructor's slides are course material and are kept locally |
