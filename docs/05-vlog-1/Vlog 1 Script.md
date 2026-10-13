# Vlog 1 — Script and shot list

**Due:** Tuesday 13 October 2026, 11:30 am. Upload to YouTube (unlisted is fine), then put the
link in the README of this repository and on the URCourses wiki.

**Target length:** about 13 min 30 s, leaving margin under the 15-minute maximum.
**Speakers:** **A** = Aubin, **C** = Chop. Lines alternate so both of us are on camera in every segment.

Every fact in the lines below comes from the Workshop 1 to 3 documents in `docs/`. Nothing is
claimed that we have not written down, so the vlog and the documents agree.

## Requirement coverage

| Vlog requirement | Segment | Time |
|---|---|---|
| Team member introductions, roles and responsibilities | 1 | 0:30 – 1:45 |
| Project background, business need and opportunity, what exists, how we differ | 2 | 1:45 – 4:30 |
| Reason for creating, golden circle (why / how / what) | 3 | 4:30 – 6:00 |
| Impact and value, the "When we are done…" statement | 4 | 6:00 – 7:30 |
| Who: audience, whose opinion matters, goals and pain points, where they are | 5 | 7:30 – 9:30 |
| What we will create, constraints and limitations | 6 | 9:30 – 11:00 |
| How: tech stack, RACI, schedule, tracking success | 7 | 11:00 – 13:15 |
| BAD and PMBOK activities highlighted | lower-third tags in every segment | — |

## Visuals to prepare before recording

| # | Visual | Source |
|---|---|---|
| 1 | Title card: "AI Learning Environment — ENSE 400 Vlog 1", both names, 13 Oct 2026 | make |
| 2 | Lower thirds with each name and role | make |
| 3 | Screen recording: a per-course folder of PDFs, then pasting a passage into ChatGPT and re-explaining the course | record |
| 4 | Pitch deck slide 8 (Linda's quote) | `docs/03-pitch/ENSE400_Three_Project_Pitches_v6.pptx` |
| 5 | Competitor Analysis table | `docs/01-workshop-1/2. Competitor Analysis.pdf` |
| 6 | Golden circle: three rings labelled Why / How / What with our three answers | make |
| 7 | Impact statement slide (text in segment 4) | make |
| 8 | User Analysis table | `docs/02-workshop-2/1. User Analysis.pdf` |
| 9 | Stakeholder Analysis table | `docs/04-workshop-3/03. Stakeholder Analysis.pdf` |
| 10 | User Story Map | `docs/04-workshop-3/User Story Map.png` |
| 11 | Exclusions list and constraints list (text in segment 6) | make |
| 12 | Architecture sketch: desktop app (Electron + React, PDF.js, SQLite) → server proxy → AI providers | make |
| 13 | RACI chart | `docs/04-workshop-3/10. RACI Chart.pdf` |
| 14 | Gantt chart, then the milestone list | `docs/04-workshop-3/Gantt Chart.png`, `08. Milestone-Based Schedule.pdf` |
| 15 | Screen recording of the Kanban board | https://github.com/users/Binborg1/projects/1 |
| 16 | Charter objectives and KPIs | `docs/04-workshop-3/02. Project Charter.pdf` |
| 17 | End card with the repository URL | make |

Lower-third tags: show **BAD — Business Aware Design** or **PMBOK** with the document name
wherever the script marks `[BAD: …]` or `[PMBOK: …]`.

---

## Script

### 0. Cold open (0:00 – 0:30)

*[Visual 1, then both on camera]*

**A:** Hi, we're the team behind the AI Learning Environment, a study workspace that teaches from
the course files already on your laptop. This is our first capstone vlog for ENSE 400 at the
University of Regina.

**C:** In the next thirteen minutes we'll introduce ourselves, explain the problem we're solving
and why, who it's for, what we're building, and how we plan to get it done by April.

### 1. Team (0:30 – 1:45)

*[Visual 2 lower thirds; then Visual 13 briefly]* `[PMBOK: Roles and Responsibilities, RACI Chart]`

**A:** I'm Aubin Chriss Izere, Software Systems Engineering. I'm co-founder and co-project
manager, and I own the study core: course folders, the PDF reader, the AI layer and server proxy,
page-anchored explanations and the model picker. In the winter I take voice input, text
recognition for scanned pages, and the iPad version.

**C:** I'm Chop Kur, also Software Systems Engineering. I'm the other co-founder and co-project
manager, and I own practice and Pro: local storage and course history, flashcards and quizzes this
term; then accounts, the Pro subscription and payments, usage limits and spaced review in the
winter.

**A:** Project management is shared. Each of us plans, builds and tests the features we own. We
review each other's pull requests before anything is merged, and we review the schedule and the
risks together every week.

**C:** Some work is shared, with one of us accountable. I'm accountable for the planning
documents, the Kanban board and scrum updates, the usability sessions, and accuracy and
performance testing. Aubin is accountable for the prototypes, the system architecture, the
pitches and vlogs, and the final release.

### 2. Background, business need and opportunity (1:45 – 4:30)

*[Visual 3]* `[BAD: Business Case]`

**A:** Here's the background. University students do most of their studying from files they've
already downloaded: lecture slides, textbook chapters and assignment PDFs, saved from UR Courses
into a folder per course. Most of us also use an AI assistant like ChatGPT, Claude or Gemini, and
study tools like NotebookLM, Quizlet or Anki.

**C:** The problem is that those tools are disconnected from the files. To get help with one
page, you upload the file or paste the passage into a chat, explain which course it's from, and
repeat that setup in every new session. The answer usually doesn't point back to the page it came
from, so you can't easily check it. And flashcards and quizzes get made separately, by hand, in
another app.

*[Visual 4]*

**A:** This came out of a primary-research interview with Linda, a U of R student. Her words
were: "It would be smoother if it could see the file I'm studying and explain it." That sentence
is our problem statement.

**C:** So the business need is three things. Repeated setup: students lose time and focus
re-supplying the same context. Unverifiable answers: explanations aren't tied to the page being
read. And manual practice: making cards by hand is the main reason students stop using spaced
repetition.

*[Visual 5]* `[BAD: Competitor Analysis]`

**A:** What's already out there? NotebookLM gives source-grounded answers, but every file has to
be uploaded and it runs only in the cloud. Adobe Acrobat's AI Assistant works one document at a
time and has no practice features. Goodnotes AI is notebook-centred and iPad-first, and weaker on
desktop. General assistants need context set up by hand every session. Anki and Quizlet have
proven spaced repetition, but no explanations, and the cards are made by hand.

**C:** No current tool combines three things: working from the course folders already on your
device, explanations anchored to the exact page, and practice generated from the same passage.
That gap is our opportunity.

**A:** We picked this on September 15 from three ideas we pitched. The other two were uofrEats, a
campus food-ordering platform, and AI-assisted drones for crop scouting. We chose this one
because it's backed by a real interview, it needs no hardware or outside partners, and we have the
problem ourselves. We both study from PDFs every week.

### 3. Reason: why we are creating (4:30 – 6:00)

*[Visual 6]*

**C:** Why are we creating? The engineer's answer is to solve a problem, and this one is ours.
But we went a level deeper with Simon Sinek's golden circle from ENSE 281.

**A:** Our *why*: we believe students should be able to learn from the material they already
have, and be able to check every answer against the source. Study help should sit inside the study
session, not interrupt it.

**C:** Our *how*: work from local files and keep them there. Anchor every explanation to the page
it came from. And turn the same passage into practice, so review actually happens.

**A:** Our *what*: a desktop study workspace, free to start, running on free AI models, with a Pro
subscription for students who want stronger models.

**C:** There's a second reason. We want to find out whether a two-person, self-funded team can
build something students will use, and that some will pay for. The capstone is our test of that.

### 4. Impact and value (6:00 – 7:30)

*[Visual 7]* `[BAD: KPIs]` `[PMBOK: Project Charter objectives]`

**A:** Here's our impact statement. When we are done, a student who today re-uploads files every
session, gets answers they can't verify, and makes flashcards by hand, will now open the PDF they
already have, select a passage, ask, and get an explanation that cites the page, with flashcards
and a quiz generated from that same passage and review scheduled before their exams.

**C:** So we think we need to: learn Electron, PDF.js and a model-independent AI layer. Test the
free cloud models for quality, speed and rate limits, which is our biggest technical unknown. Test
a prototype with at least five students on October 20, and the working app with five more by
December 1. Interview three to five more students so our user tables rest on findings, not
assumptions. And ship in two releases: the study core this fall, then Pro, review and iPad in the
winter.

**A:** How we'll know it worked: at least fifty percent less time from opening a file to a first
useful answer, measured in usability sessions. A page reference on every explanation, with at
least eighty-five percent rated accurate against the page. And a System Usability Scale score of
seventy or higher.

### 5. Who (7:30 – 9:30)

*[Visual 8]* `[BAD: User Analysis]`

**C:** Who is this for? Our primary audience is U of R undergraduates, eighteen to twenty-four,
mostly second to fourth year in engineering, science and business. They study in one-to-three-hour
blocks between classes and late in the evening, from PDFs downloaded from UR Courses. They already
ask ChatGPT for explanations and watch YouTube walkthroughs. And they're on a student budget, so
they're sensitive to subscription pricing.

**A:** Their goal is simple: understand the material faster and walk into the exam prepared.
Their pain points are the ones we listed: re-supplying context, answers not anchored to the page,
no fast way to check understanding right after reading, review that happens under exam pressure
instead of on a plan, and wanting course files to stay on the device.

**C:** Our secondary audience is graduate and thesis students, twenty-two to thirty, who read a
high volume of papers and care about recall across many documents and keeping unpublished
material off third-party servers. We're not building features specifically for them during the
capstone, but we'll interview one or two in the winter to check the fit.

*[Visual 9]* `[BAD: Stakeholder Analysis]` `[PMBOK: Stakeholder Management Plan]`

**A:** Whose opinion matters? Dr. Maciag, who approves the direction and grades every
deliverable. Linda, whose interview started this. Our design-partner students, classmates who will
test the app on their own course files. Our capstone peers at the usability session on October 20.
And the Cultivator HQ mentors who hear our final pitch on October 13. Longer term, the AI model
providers, and the instructors and publishers who own the course material, also shape what we can
do.

**C:** Where are they? Mostly in the same building. Our users and testers are on the U of R
campus in Regina, which means we can run fifteen-minute feedback sessions between classes. They
get their information digitally: UR Courses, ChatGPT, YouTube and classmates. Word of mouth,
starting from the design partners, is how we plan to reach them. SSE faculty read our GitHub
repository and our course deliverables, which is why everything we do is in the repo.

### 6. What we will create, and the constraints (9:30 – 11:00)

*[Visual 10]* `[PMBOK: Project Requirements, Scope Statement]`

**A:** What are we building? Release 1, due December 1 for ENSE 400, is the study core. Add a
local folder as a course and see your PDFs by course. Open them in a built-in reader with
navigation, zoom and search. Select a passage or a page, ask by typing, and get a streamed
explanation that shows the file and page and jumps there in one click. A model picker sorted from
cheapest to most expensive, free by default. Flashcards and quizzes generated from the selection,
marked instantly and saved per course. And a privacy notice before first use.

**C:** Release 2, Winter 2027 for ENSE 477: accounts, the Pro subscription with monthly usage
limits, spaced review against exam dates with a daily queue, voice input, text recognition for
scanned pages, and an iPad version. Altogether that's nineteen functional, nine technical and
eight performance requirements, broken into six deliverables and eighteen work packages.

*[Visual 11, exclusions]*

**A:** And what we're not building: no Android, iPhone, Linux or web versions. PDFs only. No
uploading or syncing course files to any server. No sharing between students. No LMS integration.
And no training our own models.

*[Visual 11, constraints]* `[PMBOK: Risks]`

**C:** The constraints. Knowledge: we're new to Electron, PDF.js, multi-provider AI adapters and
payments. Technology: free AI tiers have rate limits shared by every student on our key, their
terms can change, free models may give weaker answers, and scanned PDFs have no text layer. Access
to customers: we have one validated interview so far, and our peers' testing time is limited.
Money: self-funded, with a ceiling of about one hundred and fifty US dollars over two terms. Time:
two people at eight to ten hours a week. And legal: course materials belong to instructors and
publishers.

**A:** Those constraints shaped the design. The shared rate limit is why we keep at least two
free providers and fall back automatically. The budget is why the free tier runs on free models
and Pro pays for itself. The copyright constraint is why we send only the selected passage and
files never leave the device.

### 7. How (11:00 – 13:15)

*[Visual 12]*

**C:** How will we build it? The desktop app is Electron and React, on Windows and macOS. PDF.js
renders pages and gives us the text layer and the page numbers. SQLite on the device stores
courses, explanations, flashcards and quiz results. Course files are read in place and never
copied.

**A:** The AI layer is one model-independent interface, with each provider as an adapter: the
Gemini API free tier, Groq and OpenRouter's free models on the free side, and Anthropic's Claude
Haiku, Sonnet and Opus as paid options. No API keys live in the app. Requests go through a small
server proxy on a free hosting tier that holds the keys and rate-limits. Flashcards and quizzes
come back as JSON and are checked against a schema. In the winter we add Supabase for accounts and
Stripe for payments, and we pick the iPad approach, probably React Native, at the start of
ENSE 477.

*[Visual 13]* `[PMBOK: RACI Chart]`

**C:** Here's our RACI: eighteen activities across the two of us, Dr. Maciag, Linda, the design
partners, our peers and the mentors. The pattern is simple. Whoever owns a feature is accountable
and responsible, the other is consulted, and Dr. Maciag is informed. For shared work, one of us is
accountable and the other is responsible. Linda and the design partners are consulted on
explanations, flashcards and spaced review.

*[Visual 14]* `[PMBOK: Activity-Based and Milestone-Based Schedules]`

**A:** The schedule. October 13: the final pitch at Cultivator HQ and this vlog. October 20:
low- and high-fidelity prototypes and the usability session. October 27: results analysed,
architecture done, development starts and scrums begin. November 3: course folders and the PDF
reader with passage selection. November 17: explanations with page references and the model
picker. November 24: bazaar day demo. December 1: flashcards and quizzes, Release 1 complete,
Vlog 2. Then the winter: accounts and Pro by late January, spaced review and voice by late
February, the iPad beta and the pilot in mid-March, and the final release in early April.

*[Visual 15, then Visual 16]* `[BAD: Business Model, KPIs]`

**C:** Tracking success. Day to day, every work package is a GitHub issue, labelled by who's
accountable, on a Kanban board with Backlog, Doing, Review and Done. We meet weekly to review the
board, the schedule and the risks, and every pull request is reviewed by the other person. For the
product, our charter has seven objectives with KPIs: a page reference on every explanation with a
median under ten seconds; eighty-five percent accuracy over thirty sampled explanations; cards and
quizzes in under twenty seconds with eighty percent rated useful; a SUS score of seventy or more;
fifty percent less setup time; zero dollars on free-tier requests and under fifty on paid testing;
and a fifteen-student pilot with sixty percent active each week and twenty percent saying they'd
pay for Pro.

### 8. Close (13:15 – 13:45)

*[Visual 17]*

**A:** Everything we showed is in our GitHub repository: the business case, charter, stakeholder
analysis and plan, requirements, scope statement, schedules, RACI, story map, Gantt chart and the
Kanban board. The link is in the description.

**C:** Next time, on December 1, we'll be showing you a working Release 1. Thanks for watching.

---

## If we run long

Cut in this order; each item is on screen anyway:

1. The exclusions list in segment 6 (say "the scope statement lists what we're not building" and show it).
2. The KPI roll-call in segment 7 (say "seven objectives, each with a KPI" and hold on Visual 16).
3. The second sentence of each competitor in segment 2.

## BAD and PMBOK activities to highlight

| Activity | Type | Document | Segment |
|---|---|---|---|
| Competitor analysis | BAD | `01-workshop-1/2. Competitor Analysis` | 2 |
| User analysis | BAD | `02-workshop-2/1. User Analysis` | 5 |
| Business model analysis (freemium, campus licence, one-time licence) | BAD | `02-workshop-2/2. Business Model Analysis` | 7 |
| Business case with four options and cost-benefit | BAD | `04-workshop-3/01. Business Case` | 2 |
| Unique value proposition | BAD | pitch deck slide 10 | 2, 3 |
| Business goals and KPIs | BAD | `04-workshop-3/02. Project Charter` | 4, 7 |
| Project charter (goals, SMART objectives, budget, sponsors, risks) | PMBOK | `04-workshop-3/02. Project Charter` | 4, 6 |
| Stakeholder analysis and management plan | PMBOK | `04-workshop-3/03`, `04` | 5 |
| Requirements | PMBOK | `04-workshop-3/05. Project Requirements` | 6 |
| Scope statement: 6 deliverables, 18 work packages, exclusions | PMBOK | `04-workshop-3/06. Project Scope Statement` | 6 |
| Activity-based and milestone-based schedules, Gantt chart | PMBOK | `04-workshop-3/07`, `08`, `Gantt Chart.png` | 7 |
| Roles and responsibilities, RACI | PMBOK | `04-workshop-3/09`, `10` | 1, 7 |
| Change control (scope changes raised in writing as change requests) | PMBOK | `04-workshop-3/04. Stakeholder Management Plan` | 7, if time |

## Things to be careful about on camera

- Say "one validated interview so far". The graduate user type, demographics and business models
  are reasoned extension, not research, and the README says so.
- The UVP (design step 6) and user and business pain points (step 9) are not yet in tables. Do
  not say they are done.
- Winter dates are tentative. Say so once.
- The Pro model list and prices change; name the models but do not quote per-request prices.

## Upload checklist

1. Export at 1080p, confirm the runtime is under 15:00.
2. Upload to YouTube as unlisted. Title: "AI Learning Environment — ENSE 400 Vlog 1 (Izere, Kur)".
3. Description: one-line summary plus `https://github.com/Binborg1/Final-2027`.
4. Put the YouTube link in the README **Vlogs** table and on the URCourses wiki.
5. Commit the README change before 11:30 am on 13 October.

## Reuse in project documentation

The golden circle (segment 3) and the impact statement (segment 4) are not in any deliverable yet.
Both can go into the Workshop 4 documents, and the golden circle is a natural home for the UVP
table (design step 6).
