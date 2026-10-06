# ENSE 400 Capstone — Final-2027

Course documents for the ENSE 400/477 capstone with Dr. Tim Maciag, University of Regina.

**Team:** Aubin Chriss Izere (200490675) · Chop Kur (200497265)

## Project direction

**AI Learning Environment** — a study workspace that works from the course files already
on the student's device. Open a PDF, select a page or passage, ask by text or voice, and
get an explanation that carries the page reference it came from. The same passage then
generates flashcards and quizzes, and review is scheduled against exam dates. Desktop
first (Electron + React), iPad later. Original files stay on the device; only the selected
passage is sent to an AI model.

**AI approach:** passage analysis, flashcards and quizzes run on free cloud AI models
(for example the Gemini API free tier, Groq and OpenRouter's free models). For
explanations, the student picks a model from a list sorted from least to most expensive.
The free model is the default; paid models are unlocked by a Pro subscription that covers
their cost. The project is self-funded.

Selected from three ideas pitched on 15 September 2026 (see `docs/03-pitch/`). The two
alternatives were **uofrEats**, a campus food ordering and pickup platform, and
**AI-Assisted Drones** for crop scouting and fire detection. The AI Learning Environment was
chosen because it is backed by a real student interview, it needs no hardware or outside
partners, and both team members have the problem themselves. The full reasoning is in the
Business Case.

## What's where

| Folder | Contents |
|---|---|
| `docs/00-lectures/` | Design Workshop 1 to 3 slides from Dr. Maciag |
| `docs/01-workshop-1/` | Workshop 1 deliverables — Project Ideation, Competitor Analysis |
| `docs/02-workshop-2/` | Workshop 2 deliverables — User Analysis, Business Model Analysis |
| `docs/03-pitch/` | Three-project pitch deck (.pptx and .pdf), delivered 15 Sept 2026 |
| `docs/04-workshop-3/` | Workshop 3 planning documents, user story map and Gantt chart |

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
| — | [User Story Map](docs/04-workshop-3/User%20Story%20Map.md) | Student journey with Release 1 (Fall) and Release 2 (Winter) stories |
| — | [Gantt Chart](docs/04-workshop-3/Gantt%20Chart.png) | Visual schedule built from document 07 |

## Who owns what

Project management is shared and the work is split by feature.

- **Aubin:** course folders, PDF reader, AI layer and server proxy, page-anchored
  explanations, model picker; in Winter, voice input, text recognition and the iPad version.
- **Chop:** local storage, flashcards and quizzes; in Winter, accounts, the Pro
  subscription and payments, usage limits and spaced review.

Each work package is a GitHub issue (#1 to #18), labelled by type and by who is accountable,
and grouped into two milestones: **ENSE 400 - Fall 2026** (due 1 December 2026) and
**ENSE 477 - Winter 2027** (due 9 April 2027, tentative). Progress is tracked on the
[Kanban board](https://github.com/users/Binborg1/projects/1) (Backlog, Doing, Review, Done).

## Design process status

Workshop 1 set out a nine-step research design process:

| # | Step | Status |
|---|---|---|
| 1 | Project name | Done (working name) |
| 2 | Key users | Done |
| 3 | Key user problems / needs | Done |
| 4 | Solutions and features | Done |
| 5 | Requirements | Done — `05. Project Requirements` |
| 6 | Unique value proposition | In the pitch deck, not yet in a table |
| 7 | Competitive strategy | Done |
| 8 | Business goals and KPIs | Done — goals, SMART objectives and KPIs in `02. Project Charter` |
| 9 | User and business pain points | Not started |

## Research evidence

Primary-research interviews completed so far:

- **Linda**, student — the AI Learning Environment problem statement comes from this
  interview.
- **Manmeet**, manager at Da India Curry House Xpress — supports the uofrEats idea, which
  was not selected.

Everything else in the deliverable tables (the graduate and design-partner user types,
demographics, habits, and all three business models) is reasoned extension rather than
validated research, and still needs to be tested with real students.

## Upcoming

| Date | What |
|---|---|
| 13 Oct 2026 | Final pitch at Cultivator HQ (5 min) and Vlog 1 (due 11:30 am) |
| 20 Oct 2026 | Low- and high-fidelity prototypes and usability questionnaire ready; usability session |
| 27 Oct 2026 | Usability analysis, redesign and architecture; development and scrums start |
| 24 Nov 2026 | Bazaar day work-in-progress demo |
| 1 Dec 2026 | Release 1 complete; Vlog 2 |

## Outstanding

1. Interview three to five more students and replace the assumed table rows with findings.
2. Complete step 9 of the design process and put the UVP (step 6) in a table.
3. Test the free cloud models for explanation quality, speed and rate limits — the main
   technical unknown.
4. Workshop 4: low- and high-fidelity prototypes and the usability questionnaire.
