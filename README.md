# Funza Teacher Studio

ENSE 400/477 software systems engineering capstone, University of Regina, with Dr. Tim Maciag (Fall 2026 to Winter 2027).

**Team:** Aubin Chriss Izere (200490675) · Chop Kur (200497265)

## What it is

Funza Teacher Studio is a web app for **Saskatchewan Grade 10–12 teachers**. Teachers use it to prepare course materials with AI help and to run live quizzes in class. Students answer on their phones without making an account.

- **Live (in class).** The teacher picks a chapter, an uploaded PDF or a saved quiz. Funza suggests questions, and the teacher keeps the ones they want and sets a timer. Students scan a QR code, enter their name and answer on their phones. Funza marks the answers, the teacher reveals them to the class, and the results show which questions most students missed.
- **Prepare (before and after class).** The teacher builds courses whose chapters start from the Saskatchewan curriculum, then makes notes, slides, quizzes, tests and exams with Funza, from built-in or their own exam templates and a question bank that grows with every approved question. Nothing reaches students until the teacher approves it. Materials are published to a course page (link or QR code), Google Classroom, or print.

**Funza drafts; the teacher approves.** Only teachers have accounts. Student data is kept to a minimum, stored in Canada, and deleted 30 days after a session.

## Where things stand (21 November 2026)

- **Planned and specified:** the [user flows and features](docs/03_design/01_user_flows_and_features/) (19 November) and the [requirements and architecture](docs/03_design/02_requirements_and_architecture/requirements_and_architecture.md) (21 November). The product definition was locked on 21 November.
- **Built so far:** the app in [`app/`](app/) covers the Prepare path for one teacher in one browser: pick curriculum outcomes, describe the resource, let Funza draft it, review and approve it, then post it to Google Classroom or print it.
- **Next:** teacher accounts and courses on Supabase, then Live mode, for Release 1 on 1 December. The order is in the [development steps](docs/04_development/01_development_steps.md).
- **Documents:** the [document tracker](docs/document_tracker.md) lists every document the project needs and how far along each one is.

## What's where

| Path | Contents |
|---|---|
| [`app/`](app/) | The Funza app (Next.js, TypeScript, Tailwind). [app/README.md](app/README.md) explains how to run it |
| [`docs/`](docs/) | All project documents, in course order. [docs/README.md](docs/README.md) explains the layout and naming |
| [`docs/document_tracker.md`](docs/document_tracker.md) | Every document needed for ENSE 400 and ENSE 477, with its status |
| [`docs/01_research/`](docs/01_research/) | Users, competitors, business model, teacher interviews |
| [`docs/02_project_plan/`](docs/02_project_plan/) | Business case, charter, stakeholders, scope, schedules, roles, roadmaps |
| [`docs/03_design/`](docs/03_design/) | User flows and features, requirements and architecture, UI design |
| [`docs/04_development/`](docs/04_development/) | Build plan, weekly status reports |
| [`docs/05_testing/`](docs/05_testing/) | Code and usability testing |
| [`docs/06_presentations/`](docs/06_presentations/) | Work-in-progress demo, vlogs, poster, videos, final presentation |
| [`docs/07_user_guide/`](docs/07_user_guide/) | Help for teachers and students |
| [`docs/08_closing/`](docs/08_closing/) | Retrospectives and the project experience report |
| [`docs/archive/`](docs/archive/) | Documents from the products we worked on before Teacher Studio, kept as submitted |

## Technology

| Layer | Choice |
|---|---|
| App, frontend and backend | Next.js (React, TypeScript, Tailwind). The backend is the app's own API routes on Node.js |
| Hosting | Vercel, with functions in Montréal |
| Sign-in, database, files, live updates | Supabase (Auth, Postgres with row-level security, Storage, Realtime) in Canada (Central) |
| AI | Gemini API, called only from the server |
| Curriculum | Saskatchewan Grade 10–12 curricula, stored as JSON in the repo |
| Publishing | Google Classroom API, a course page, print or PDF |

## How the project got here

| When | What happened |
|---|---|
| Sept 2026 | The **AI Learning Environment**, a study app for university students, was chosen from three pitches (the others were uofrEats and AI-assisted drones). |
| Oct 2026 | A **Funza student tutor** prototype, which taught from uploaded lecture PDFs, was tested at the usability evaluation on 20 October. A proposal to widen it into Folio, a desktop workspace for non-technical users, was not pursued. |
| Nov 2026 | **We moved from students to teachers.** Both student products depended on students uploading their lecture notes and slides to an AI. Many courses, including ours, treat that as an academic integrity and copyright breach, so the products would have put their own users at risk. A teacher tool avoids the problem: teachers work from their own material and the official curriculum, and they decide what reaches students. |
| 19 Nov 2026 | The Teacher Studio plan: flows and features for Live and Prepare. |
| 21 Nov 2026 | Requirements and architecture (Vercel, Supabase, Gemini). The product is locked. |

The earlier documents are in [`docs/archive/`](docs/archive/), with what each product was and why it was dropped.

## Project management

Work is tracked on a GitHub Kanban board (Backlog, Doing, Review, Done) with two milestones: **ENSE 400 - Fall 2026** (due 1 December 2026) and **ENSE 477 - Winter 2027** (due 9 April 2027, tentative). The team meets weekly to review the board, schedule and risks, and the other member reviews every pull request before it is merged. The old board and its issues belonged to the earlier product and were removed on 21 November 2026; a new board is being set up from the Teacher Studio work breakdown.

## Coming up

| Date | What |
|---|---|
| 24 Nov 2026 | Work-in-progress demo (bazaar day) |
| 1 Dec 2026 | Release 1 complete; vlog 2 and the fall retrospective |
| Winter 2027 | ENSE 477: Release 2, testing with teachers, final presentation |

## Run the app

```bash
cd app
npm install
npm run dev
```

Then open http://localhost:3000. Configuration and the full guide are in [app/README.md](app/README.md).
