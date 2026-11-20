# ENSE 400 Capstone — Final-2027

Course documents and code for the ENSE 400/477 capstone with Dr. Tim Maciag, University of Regina.

**Team:** Aubin Chriss Izere (200490675) · Chop Kur (200497265)

## The product: Funza Teacher Studio

Funza is a teaching tool for Saskatchewan Grade 10–12 teachers. It has two modes:

- **Live.** The teacher uploads notes or picks a chapter, Funza suggests questions, and the teacher picks how many and sets a timer. Students scan a QR code, enter their name and student number, and answer on their phones. When time is up, Funza marks the answers, the teacher reveals them to the class, and the results show which questions most students missed.
- **Prepare.** The teacher builds courses whose chapters come from the Saskatchewan curriculum, then makes notes, slides, quizzes, tests and exams with Funza (from a saved exam template, a past exam, or plain-language instructions). Everything is reviewed and approved by the teacher before students get it through a course QR code or link, Google Classroom, or print.

Funza drafts; the teacher approves. Students never make an account.

**Where the code is today.** The app in [`app/`](app/) covers the Prepare path for one teacher in one browser: pick curriculum outcomes, describe the resource, let Funza draft it, review and approve it, then post it to Google Classroom or print it. Live mode, teacher accounts, courses, templates and student pages are planned in [`docs/07_teacher_studio/`](docs/07_teacher_studio/).

## How the project got here

| When | What |
|---|---|
| Sept 2026 | The **AI Learning Environment**, a study tool for students, was chosen from three pitches (the others were uofrEats and AI-Assisted Drones). See `docs/03_pitch/` and the Business Case. |
| Oct 2026 | A student tutor prototype named Funza was tested at the usability bazaar on 20 October (`docs/06_usability_bazaar/`). A proposal to widen it into Folio, a desktop workspace for non-technical users, was not pursued. |
| Nov 2026 | The product moved to teachers: the teacher workspace in `app/`, then the Teacher Studio plan (19 November) in `docs/07_teacher_studio/`. |

## What's where

Naming: everything under `docs/` is lowercase `snake_case`. Files are `NN_name.ext`, numbered in order within their folder; a deliverable kept in two formats (for example .pptx and .pdf) shares one number. Folders are `NN_name` in course order.

| Path | Contents |
|---|---|
| `docs/00_lectures/` | Design Workshop 1 to 3 slides from Dr. Maciag |
| `docs/01_workshop_1/` | Workshop 1 deliverables: Project Ideation, Competitor Analysis |
| `docs/02_workshop_2/` | Workshop 2 deliverables: User Analysis, Business Model Analysis |
| `docs/03_pitch/` | Three-project pitch deck (15 Sept 2026) and final pitch deck for Cultivator HQ (13 Oct 2026), each as .pptx and .pdf |
| `docs/04_workshop_3/` | Workshop 3 planning documents, user story map and Gantt chart |
| `docs/05_vlog_1/` | Vlog 1 script, shot list and requirement coverage |
| `docs/06_usability_bazaar/` | Usability bazaar (20 Oct 2026): low-fidelity wireframes, facilitator plan and participant questionnaire, each as source plus a print-ready PDF; `04_wireframes_figma/` holds the same screens as SVGs for the Figma file, https://www.figma.com/design/2EKJLy3nigXgurkl4vLqE2 |
| `docs/07_teacher_studio/` | Teacher Studio plan (19 Nov 2026): user flows for Live and Prepare, exam templates, use cases, and what to keep, combine, remove and build in the current app. As a web page (`01_user_flows_and_features.html`), a PDF, and the diagrams as PNG and SVG in `diagrams/` |
| `app/` | The Funza app (Next.js, TypeScript, Tailwind). See [app/README.md](app/README.md) to run it |
| `vlog1.mp4` | Vlog 1 video (submitted on UR Courses) |

### Workshop 3 documents

| # | Document | What it covers |
|---|---|---|
| 01 | Business Case | Background, need, four options with cost-benefit, recommendation |
| 02 | Project Charter | Goals, SMART objectives with KPIs, budget, sponsors, milestones, risks |
| 03 | Stakeholder Analysis | Ten stakeholders rated on power, interest and support |
| 04 | Stakeholder Management Plan | How each stakeholder is managed |
| 05 | Project Requirements | 19 functional, 9 technical and 8 performance requirements |
| 06 | Project Scope Statement | Work breakdown: 6 deliverables, 18 work packages, exclusions |
| 07 | Activity-Based Schedule | Every activity with duration and dates, Sept 2026 to April 2027 |
| 08 | Milestone-Based Schedule | 13 milestones |
| 09 | Project Roles and Responsibilities | Feature ownership and shared work |
| 10 | RACI Chart | 18 activities across the team and stakeholders |
| 11 | [User Story Map](docs/04_workshop_3/11_user_story_map.md) | Student journey with Release 1 (Fall) and Release 2 (Winter) stories |
| 12 | [Gantt Chart](docs/04_workshop_3/12_gantt_chart.png) | Visual schedule built from document 07 |

The Workshop 3 documents were written for the student study tool. Their feature split and story map will be redone for the Teacher Studio.

## Project management

Project management is shared. Each work package is a GitHub issue (#1 to #18), labelled by type and by who is accountable, and grouped into two milestones: **ENSE 400 - Fall 2026** (due 1 December 2026) and **ENSE 477 - Winter 2027** (due 9 April 2027, tentative). Progress is tracked on the [Kanban board](https://github.com/users/Binborg1/projects/1) (Backlog, Doing, Review, Done).

## Design process status

Workshop 1 set out a nine-step research design process:

| # | Step | Status |
|---|---|---|
| 1 | Project name | Done (Funza) |
| 2 | Key users | Done for students; redo for teachers |
| 3 | Key user problems / needs | Done for students; redo for teachers |
| 4 | Solutions and features | Teacher Studio plan in `docs/07_teacher_studio/` |
| 5 | Requirements | `05_project_requirements.pdf` (student tool) |
| 6 | Unique value proposition | In the pitch deck, not yet in a table |
| 7 | Competitive strategy | Done |
| 8 | Business goals and KPIs | Done: goals, SMART objectives and KPIs in `02_project_charter.pdf` |
| 9 | User and business pain points | Not started |

## Research evidence

Primary-research interviews completed so far:

- **Linda**, student: the AI Learning Environment problem statement came from this interview.
- **Manmeet**, manager at Da India Curry House Xpress: supports the uofrEats idea, which was not selected.

No teachers have been interviewed yet. Interviews with Grade 10–12 teachers are the next research step for the Teacher Studio.

## Vlogs

| # | Due | Status |
|---|---|---|
| 1 | 13 Oct 2026 | Submitted on UR Courses · [script and shot list](docs/05_vlog_1/01_vlog_1_script.md) |
| 2 | 1 Dec 2026 | Not started |

## Upcoming

| Date | What |
|---|---|
| 24 Nov 2026 | Bazaar day work-in-progress demo |
| 1 Dec 2026 | Release 1 complete; Vlog 2 |
