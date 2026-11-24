# 04 · Screen Specifications

**Purpose:** detailed specifications for the five core screens (and the two supporting ones), each with its goal, actions, system feedback, an annotated wireframe, states and responsive behaviour.
**Status:** Stage A, 18 November 2026. High-fidelity mockups are the prototype screens, captured in `09_mockups/`. Open them live with `cd app && npm run dev`, then http://localhost:3000/prototype.

Wireframes are at desktop width (1440 px). Numbers in the wireframes refer to the region tables below them. Besides the per-screen mockups named below, `09_mockups/` has the journey map (`15_journey_map.png`), phone layouts (`16_mobile_home.png`, `17_mobile_review.png`, 390 px) and the tablet editor (`18_tablet_review.png`, 900 px). Every mockup is a screenshot of the running prototype with Next.js's development badge and the PROTOTYPE controls hidden.

---

## Screen 1 · Home

| | |
|---|---|
| **Teacher's goal** | Within seconds: see what is in progress, start something new, find materials |
| **Primary action** | Pick a resource type in "What do you want to make?" (opens Create with the type and outcome already set) |
| **Secondary actions** | Continue reviewing the current draft · review other drafts · start from a file · reuse a resource · browse outcomes · open the library · manage connections |
| **System feedback** | Counts come from real checks ("3 of 12 parts reviewed · 1 check failed"), never from estimates; the Classroom card shows the true connection state |

```
┌────────┬──────────────────────────────────────────────────────────────────────────────┐
│ FUNZA  │ Wednesday, 18 November 2026                                                  │
│ SK·10–12│──────────────────────────────────────────────────────────────────────────────│
│[+Create]│ (1) Welcome back, Alex                                                      │
│ Search  │     3 drafts waiting for your review. You are teaching Science 10 · Force…   │
│ ▸Home   │ ┌─(2) What do you want to make? ───────────────────┐ ┌─(5) Outcomes you ─────┐│
│  Library│ │ For [Science 10 · SCI10-FM2 ▾] — Investigate and… │ │ used recently         ││
│  Curric.│ │ [Notes][Quiz][Exam][Lesson plan][Worksheet][More▾]│ │ SCI10-FM2  Yesterday  ││
│         │ │ ↑ Start from a file · Reuse · Browse outcomes     │ │ “Investigate and…”    ││
│ YOUR    │ └───────────────────────────────────────────────────┘ │ ◐ Official  Create →  ││
│ COURSES │ PICK UP WHERE YOU LEFT OFF                            └───────────────────────┘│
│ ● Sci 10│ ┌─(3)─────────────────────────────────────────────────┐ ┌─(6) Where your ─────┐│
│ ○ Phys30│ │ [page] Quiz · edited yesterday                      │ │ students get it     ││
│         │ │ thumb  Constant speed in a straight line · Quiz     │ │ Google Classroom    ││
│         │ │        Science 10 · SCI10-FM2                       │ │      ○ Not connected││
│         │ │        3 of 12 parts reviewed · 1 check failed      │ │ [Manage connections]││
│         │ │        ▓▓▓░░░░░░░░             [Continue reviewing→]│ └─────────────────────┘│
│         │ └─────────────────────────────────────────────────────┘ ┌─(7) What Funza ─────┐│
│Integr. ●│ (4) Also waiting for review                             │ covers today        ││
│Shortcuts│  [icon] Force and Motion · Unit exam  ✕1 Failed  [Review]│ 4 outcomes, Sci 10  ││
│ AM Alex │  [icon] Acceleration · Worksheet    ◆3 Needs you [Review]└─────────────────────┘│
│         │ (4b) Recently edited  ── table: resource · outcomes · status · edited ──       │
└────────┴──────────────────────────────────────────────────────────────────────────────┘
```

| Region | Content and rules |
|---|---|
| 1 Header | First name only. One sentence built from real state: drafts waiting and the current unit. No statistics tiles |
| 2 Create panel | The outcome selector lists catalog outcomes and "Browse the curriculum…"; the official wording appears beside it. Five tiles for the frequent types; "More" opens a menu (unit test, homework, presentation, interactive graph). One faint orbit from the logo in the corner: the screen's only decoration |
| 3 Continue | The most recently edited draft: a thumbnail drawn from its real structure (gold dots are parts still to review), reviewed count, failed checks, a progress bar of parts reviewed (not a confidence measure) |
| 4 Waiting | Other drafts with their blocking checks. 4b: the six most recent resources with status |
| 5 Recent outcomes | Code, wording (two lines), verification mark, "Create from this" |
| 6 Delivery | Classroom state; "Downloads always work"; planned platforms named as planned |
| 7 Coverage | What is in the catalog today, with a link to the official site |

**States.** First visit: header says "Welcome to Funza", region 3 is replaced by a three-step start (pick your courses, create, approve), and region 4 is hidden. No drafts: "Everything you drafted is reviewed." Loading (Stage B, from the server): skeleton rows in 3 and 4 at their final size.

**Responsive.** Below 1024 px the right column moves under the left. Below 640 px the type tiles become a two-column grid.

**Prototype.** Functional: every link and tile, the outcome selector, counts (computed by the real checks). Sample: the teacher, the drafts and their dates.

Mockup: `09_mockups/01_home.png`.

---

## Screen 2 · Curriculum Explorer

| | |
|---|---|
| **Teacher's goal** | Find the official outcome(s) a resource is for, and know how far to trust the wording |
| **Primary action** | "Create from this outcome", or select several and "Create from N outcomes" |
| **Secondary actions** | Filter by grade and subject · search code, wording or course · open the official page · read the indicators' status · add to selection |
| **System feedback** | Every outcome shows its verification mark; missing courses say they are missing; staged indicators say they cannot be used |

```
┌────────┬──────────────────────────────────────────────────────────────────────────────┐
│ rail   │ Curriculum                                                                   │
│        │ SASKATCHEWAN · GRADES 10 TO 12                                    (i) Badges │
│        │ Curriculum — quoted exactly from curriculum.gov.sk.ca …                      │
│        │ (1)[All|10|11|12] [All|Science|Math] [🔍 Search by code (FM2), words, course]│
│        │ Recently used: [SCI10-FM2 Yesterday] [SCI10-FM3 Saturday]                    │
│        │ ┌(2) Courses ──────┐┌(3) Science 10 ─────── Official page ↗┐┌(4) SCI10-FM2 ─────┐│
│        │ │GRADE 10 · 10-LEVEL││Force and Motion in Our World  4     ││◐ Official source · ││
│        │ │● Science 10       ││┌──────────────────────────────────┐││  2nd check pending ││
│        │ │  1 unit in Funza  │││☐ SCI10-FM1 ◐ Official  Ind. pend.│││OFFICIAL WORDING    ││
│        │ │○ Foundations of…10│││  Explore the development of …    ││││“Investigate and   ││
│        │ │  Not in Funza yet │││☑ SCI10-FM2 ◐ …  (focused)        ││││ represent …”      ││
│        │ │GRADE 11 · 20-LEVEL│││☐ SCI10-FM3 …                     │││[Create from this →]││
│        │ │○ Computer Sci 20  │││☐ SCI10-FM4 …                     │││[Add to selection]  ││
│        │ │…                  ││└──────────────────────────────────┘││Indicators  Not ver.││
│        │ │GRADE 12 · 30-LEVEL││ ◌ Other Science 10 units are not in ││┌ ◌ Awaiting team ─┐││
│        │ │○ Physics 30 …     ││   Funza's catalog yet.              │││(a) Provide exam…  │││
│        │ │note on source list│└─────────────────────────────────────┘││(b) not captured   │││
│        │ └───────────────────┘                                       ││(b) second “(b)” ! │││
│        │                                                             ││Source and checks   ││
│        │                                                             ││ timeline ✓ ◷ ✕     ││
│        │ ┌(5) 2 outcomes selected · SCI10-FM2, SCI10-FM3  [Clear][Create from 2 →]┐     │
└────────┴──────────────────────────────────────────────────────────────────────────────┘
```

| Region | Content and rules |
|---|---|
| 1 Filters | Grade maps 10/20/30-level courses to Grades 10/11/12 (students may take them in other years; the label says "10-level"). Search covers outcome codes and wording in the catalog and course names on the official list |
| 2 Courses | The 19 Science and Mathematics course names from the official home page, grouped by level. A filled dot means Funza has content; an open dot means "Not in Funza yet". Footnote records where the list came from and the discrepancy noted in `06_curriculum_ux.md` |
| 3 Outcomes | One row per outcome: checkbox (select), code, verification mark, "Indicators pending", verbatim statement. Clicking the row focuses it in 4; the checkbox selects it. Units not copied say so |
| 4 Detail | Code, mark, course and unit, the official wording (quoted, navy rule, not editable), primary and secondary actions, indicators with their true state, source and checks (publisher, page, version label or "None shown on the page", fingerprint, reuse terms), and a timeline: copied ✓, second check ◷ pending, indicators ✕ pending. "What to know before relying on it" lists the catalog's own limitations (`outcomeLimitations()`) |
| 5 Selection tray | Appears when one or more outcomes are selected; carries them into Create |

**States.** A course not in Funza: an empty state that explains why there is nothing to align to and links to the official site. No search results: says what is searched. Loading (Stage B): skeleton rows.

**Responsive.** Below 1280 px the detail moves under the list. Below 768 px everything stacks and the course list becomes collapsible.

**Prototype.** Functional and real: the catalog, statuses, fingerprints and limitations (`app/src/lib/curriculum/catalog.ts`). Real but unverified: course names and the SCI10-FM2 indicators (read on 18 Nov 2026). The "Awaiting team review" indicators never feed generation.

Mockup: `09_mockups/02_curriculum.png`.

---

## Screen 3 · Create (the resource generator)

| | |
|---|---|
| **Teacher's goal** | Say what is needed in a minute and know exactly what Funza will make before it makes it |
| **Primary action** | **Generate draft** |
| **Secondary actions** | Change type, outcomes, question mix, marks, time, difficulty, ordering, extras · add a file or a library resource · add a note · write it yourself (when AI is unavailable) · cancel |
| **System feedback** | The blueprint updates on every change; warnings explain problems (too much work for the time, no sample content); generation shows named stages, elapsed time, and specific failures |

```
┌────────┬──────────────────────────────────────────────────────────────────────────────┐
│ rail   │ Home / Create                                                                │
│        │ Create a resource                                   ┌(6) BLUEPRINT ─────────┐│
│        │ ┌(1) ✓ What are you making? ──────────────────────┐ │A 30-minute quiz for   ││
│        │ │ Teaching notes  [Teaching notes]                │ │Science 10 on SCI10-FM2:││
│        │ │ Assessments     [Quiz ✓][Unit test][Exam]       │ │12 questions, 20 marks.││
│        │ │ Classroom       [Lesson plan][Worksheet][Homew.]│ │[✦ Generate draft     ]││
│        │ │                 [Presentation][Interactive graph]│ │ 12 │ 20 │ 21 est.min  ││
│        │ └─────────────────────────────────────────────────┘ │Parts                  ││
│        │ ┌(2) ✓ Which outcomes? ───────────────────────────┐ │A · Multiple choice 4  ││
│        │ │ [◐ SCI10-FM2 ×] [+ Add outcome]                  │ │B · True or false   2  ││
│        │ │ ▌SCI10-FM2 “Investigate and represent …”         │ │…                      ││
│        │ │ Indicators not verified: aligns to statements    │ │Planned marks          ││
│        │ └─────────────────────────────────────────────────┘ │ FM2  6 │ 10 │ 4       ││
│        │ ┌(3) ✓ Details ───────────────────────────────────┐ │✓ Answer key, separate ││
│        │ │ Title [Constant speed … · Quiz          ]       │ │✓ Worked solutions     ││
│        │ │ Time [− 30 + min]  Order [By type|Easiest|Outc.]│ │✓ Rubric               ││
│        │ │ Question mix  type │ how many │ marks │ total   │ │What Funza does …      ││
│        │ │               MC   │ [−4+]    │ [−1+] │ 4       │ │ · cites only FM2      ││
│        │ │               …                         20      │ │ · recalculates        ││
│        │ │ Difficulty [Balanced|Review|Challenge] ▓▓▓▓▓░░  │ │ · marks AI parts ✦    ││
│        │ │ ⊙ Answer key  ⊙ separate  ⊙ worked  ⊙ rubric    │ └───────────────────────┘│
│        │ └─────────────────────────────────────────────────┘                          │
│        │ ┌(4) Your own material (optional) ────────────────┐                          │
│        │ │  ↑ Drop your notes, an old test or slides here   │                          │
│        │ │  Or build on something in your library [ ▾ ]     │                          │
│        │ └─────────────────────────────────────────────────┘                          │
│        │ ┌(5) Anything else? (optional) [textarea] [+ Use Saskatchewan examples] …┐   │
└────────┴──────────────────────────────────────────────────────────────────────────────┘
```

| Region | Content and rules |
|---|---|
| 1 Type | Nine types in three groups. Notes add a style choice: comprehensive, concise summary, worked examples, simplified explanation, revision sheet. Changing type loads that type's preset and keeps outcomes, file and note |
| 2 Outcomes | Chips with remove; "Add outcome" lists the catalog and "Browse the curriculum…". The official wording of each chosen outcome is shown in full. At least one is required |
| 3 Details | Assessments: title, time, order, question mix (7 types × count × marks each, live totals), difficulty preset with the split it means, answer key, separate file, worked solutions, rubric. Notes: key terms, interactive graph, check questions. Lesson plan: class length, adaptations. Presentation: slides, speaker notes (PowerPoint export marked planned). Interactive graph: a live preview from the real visualization registry |
| 4 Material | Drop zone or file picker (PDF, Word, PowerPoint); shows name and size; "Stick to it" or "Use as ideas". The file is read in the browser and only its text is sent, on Generate. Or pick a library resource to build on |
| 5 Note | Optional plain-language note (600 characters) with suggestion chips. It cannot widen the outcomes |
| 6 Blueprint | Computed by code from 1–5, no AI: one-sentence summary, **Generate**, totals, parts with marks, planned marks by outcome and difficulty (a table of specifications), what is included, warnings, and what Funza will do with the brief |

### Generation states

```
┌(A) Drafting your quiz ─────────────────┐  ┌(B) the page, assembling ───────────────┐
│ 12 s · usually under a minute.          │  │ SCIENCE 10 · SCI10-FM2                 │
│ Keep this tab open.                     │  │ Constant speed … · Quiz                │
│ ✓ Checking the outcomes                 │  │ 12 questions · 20 marks · 30 minutes   │
│   SCI10-FM2: found, wording intact      │  │ Part A · Multiple choice               │
│ ✓ Fixing the blueprint                  │  │  ░░░░░░░░░░░░░░░░░░░░░                 │
│ ◌ Drafting with the AI provider         │  │  ░░░░░░░░░░░░░░░                       │
│ ○ Validating the reply                  │  │ Part B · True or false                 │
│ ○ Recomputing answers                   │  │  ░░░░░░░░░░░░░░░░░░                    │
│ [Cancel]                                │  │ Funza shows the draft only after it    │
└─────────────────────────────────────────┘  │ has been validated. Unchecked text is  │
                                             │ never displayed.                       │
                                             └────────────────────────────────────────┘
```

| State | What the teacher sees | Actions |
|---|---|---|
| Running | Named stages with the current one spinning; elapsed seconds; a skeleton of the real parts | Cancel |
| Done | "Your draft is ready to review"; every stage ticked; any partial-result notices (for example "Drafted 6 of 10 multiple-choice questions" with the reason) | Open the draft · Make another |
| Cancelled | "Generation stopped. Nothing was saved. Your settings are kept." | Generate again · Write it yourself · Back to settings |
| Provider busy (429) | The failed stage marked ✕; "The AI provider is busy…" | Try again · Write it yourself · Back |
| No AI configured | "AI drafting is not set up…" | **Write it yourself from the blueprint** (empty questions laid out as planned) · Back |
| Invalid reply | "The model's reply cited an outcome code that Funza did not supply, so Funza rejected the whole reply…" | Try again · Write it yourself · Back |

No draft text appears until it has passed validation and recomputation. The stages map to real server steps in Stage B; the route does not stream today, so the client shows "Drafting" until the reply arrives and then the two local steps.

**Responsive.** Below 1024 px the blueprint moves above the form as a collapsible summary with Generate. On phones the form is one column.

**Prototype.** Functional: every control, the blueprint (real computation), the outcome check (real catalog), answer recomputation, the live graph. Simulated: the AI call and its timing; the result is chosen under PROTOTYPE. Sample: the drafted questions (hand-written).

Mockups: `09_mockups/03_create.png`, `04_generating.png`, `05_generation_failed.png`.

---

## Screen 4 · Review, edit and curriculum alignment

| | |
|---|---|
| **Teacher's goal** | Make the draft right, see the evidence that it fits the outcome, and approve it with confidence |
| **Primary action** | **Approve** (blocked until nothing has failed and nothing waits on the teacher) |
| **Secondary actions** | Edit text in place · mark parts reviewed · fix failed checks · add, delete, duplicate, move questions · reorder sections · regenerate one question · change marks, difficulty, outcome, verb tags · switch lenses · change outcomes · run an optional AI second read · edit an approved resource as a new version |
| **System feedback** | Checks re-run on every change; reviews clear on any change to that part; failed checks appear inline under the part and in the panel with a fix; approval explains what is left |

```
┌────────┬──────────────────────────────────────────────────────────────────────────────┐
│ rail   │ Library / Science 10 / Constant speed … · Quiz  Draft v1   [Student|Key|Align] [✓ Approve 4 left]│
│        ├(1) Outline ────────┬(2) the page ─────────────────────────────┬(3) Checks ▸ Alignment ┐│
│        │ 3 of 12 reviewed   │ J K move · R reviewed · N next            │ ✕1 ◆3 ◌1 ✓8           ││
│        │ ▓▓░░░░ [Next ▸ N]  │ ✦ Sample draft …                          │ Every result computed…││
│        │ MULTIPLE CHOICE    │ ┌──────────── paper ───────────────────┐ │ MUST FIX              ││
│        │ ✓ Q1 A distance…   │ │ SCIENCE 10 · SCI10-FM2   SAMPLE COLL. │ │ ✕ Q10 answer key is   ││
│        │ ✓ Q2 On one…       │ │ Constant speed in a straight line …  │ │   wrong 420÷3.5=120,  ││
│        │ ✓ Q3 A horizontal… │ │ Name ____ Date ____ Class ____        │ │   key says 140 [Use]  ││
│        │ ✦ Q4 A cart moves… │ │ Total: 20 marks · Time: 30 minutes    │ │ NEEDS YOU             ││
│        │ TRUE OR FALSE      │ │ Part A · Multiple choice      4 marks │ │ ◆ 9 parts to review   ││
│        │ ✦ Q5 …             │ │ ✓ 1. A distance–time graph…      [1]  │ │ ◆ Reading level … ☐   ││
│        │ CALCULATION        │ │      a) … b) … c) … d) …              │ │ ◆ Indicators … ☐      ││
│        │ ✕ Q10 A train …    │ │ ✦ 4. A cart moves at 3 m/s …     [1]  │ │ FUNZA CAN'T CHECK     ││
│        │ …                  │ │ ┌ selected: editor ────────────────┐ │ │ ◌ 8 answers …         ││
│        │                    │ │ │ Question [textarea]               │ │ │ ▸ Passed (8)          ││
│        │                    │ │ │ Options ◉a ○b ○c ○d  [+ option]   │ │ │ ┌ AI second read ───┐ ││
│        │                    │ │ │ Marks [−1+] Difficulty ▾ Outcome ▾│ │ │ │ Optional. Never   │ ││
│        │                    │ │ │ Students must [Investigate][Repr.]│ │ │ │ verification.     │ ││
│        │                    │ │ │ [✓ Mark reviewed R][↻ Regenerate] │ │ │ │ [Run]             │ ││
│        │                    │ │ │ [↑][↓][⧉][🗑]              [Done] │ │ │ └───────────────────┘ ││
│        │                    │ │ └───────────────────────────────────┘ │ │                       ││
│        │                    │ │ ─────── + Add question ───────        │ │                       ││
│        │                    │ │ ✕ 10. A train travels 420 km …   [2]  │ │                       ││
│        │                    │ │   ✕ Q10 answer key is wrong … [Use 120 km/h]                  ││
└────────┴────────────────────┴────────────────────────────────────────────┴───────────────────────┘
```

| Region | Content and rules |
|---|---|
| Top bar | Breadcrumb, version chip (Draft vN / Approved vN), "Saved", **lens switch**, **Approve** with the count of what is left. After approval: "Edit as version N+1" and **Deliver** |
| 1 Outline | Progress of parts reviewed, "Next that needs you (N)", sections with move up/down, questions with their state mark (✦ AI unreviewed, ✓ reviewed, ↻ changed, ✕ failed). Click to jump. Hide with `[` |
| 2 Page | Exactly what prints. The gutter mark shows each part's state. Click a question to edit it in place; the editor covers the type's fields (options with the correct one, true/false, answer key and worked solution, matching pairs, rubric lines with marks) and metadata (marks, difficulty, outcome, verbs). Inserters between questions add any of the seven types. Failed checks appear under their part with a one-click fix |
| 3 Inspector | **Checks** tab: counts by state; Must fix; Needs you (with the two global confirmations as checkboxes); Funza can't check; Passed (collapsed); the optional AI second read (suggestions only; marked "out of date" after edits). **Alignment** tab: each outcome with its wording, questions and marks covering it ("12 questions · 20 of 20 marks"); the outcome's verbs ("Investigate", "Represent") matched to the parts that ask students to do them, with a plain suggestion when one is weak; blueprint against draft (marks and difficulty, planned and actual); "Change" outcomes. Hide with `]` |

**Lenses.** *Student copy*: what students get. *Answer key*: correct options highlighted, keys, worked solutions, rubric tables. *Alignment*: every part tagged with outcome, verbs, difficulty, marks, its check state and review state.

**Regenerate one question.** Guidance chips (easier, harder, different context, fix the wording), then the new version appears **beside** the current one with "Use the new version" or "Keep the current one". Nothing changes until the teacher chooses.

**Approve dialog.** If anything blocks: the list, each with "Show". Otherwise: resource, outcomes (with "statement only; indicators pending"), questions and marks, checks (passed, not machine-checkable but reviewed, zero failed), approver. Approving locks the version.

**States.** Loading (Stage B): the page frame with skeleton questions. A resource that cannot be found: an empty state with the way back. Approved: a green notice, every field read-only, "Edit as version N+1".

**Responsive.** 1024–1279 px: narrower panels. Below 1024 px: the page alone, with **Outline** and **Checks** buttons that open side sheets. Phones are for reading, light edits, reviewing and approving.

**Prototype.** Functional and real: every edit, reorder, insert, delete and duplicate; checks (structure, recomputed answers, coverage) re-run on each change; fingerprints that clear reviews; fixes; lenses; approval rules; keyboard shortcuts; the live graph in notes. Simulated: regeneration (it swaps in another hand-written sample question) and the AI second read.

Mockups: `09_mockups/06_review.png`, `07_review_answer_key.png`, `08_review_alignment.png`, `09_approve.png`.

---

## Screen 5 · Deliver (publish and export)

| | |
|---|---|
| **Teacher's goal** | Get exactly the approved version to students, in the way the school works, without retyping |
| **Primary action** | Print or save the student copy; or post to Classroom (as a draft by default) |
| **Secondary actions** | Answer key as a separate file · paper size · school name in header · Word (planned) · choose destination · connect or disconnect · choose classes, post type, topic, instructions, timing · retry a failed class · read the delivery history |
| **System feedback** | Saved-in-library confirmation; per-class progress; "delivered" only on confirmation; failures with the platform's reason and a retry; every download and post recorded |

```
┌────────┬──────────────────────────────────────────────────────────────────────────────┐
│ rail   │ Library / Constant speed … · Quiz / Deliver                 ← Back to document│
│        │ DELIVER · VERSION 1, APPROVED TODAY 4:07 PM          ┌(5) Preview ───────────┐│
│        │ Constant speed in a straight line · Quiz             │[What students get|Key|││
│        │ ┌(1) ✓ Saved in your library  Sci 10 › Force… [Open]┐│ In Classroom]         ││
│        │ └──────────────────────────────────────────────────┘│ ┌ paper ────────────┐ ││
│        │ ┌(2) Download and print     Works without connection┐│ │ SCIENCE 10        │ ││
│        │ │ ⎙ Student copy  PDF   …           [Print or save] ││ │ Constant speed …  │ ││
│        │ │ 🔒 Answer key   PDF   …           [Print or save] ││ │ Name __ Date __   │ ││
│        │ │ ↓ Word document DOCX  …           [Planned]       ││ │ 1. A distance–…   │ ││
│        │ │ Paper [Letter|A4]   School name in header ⊙       ││ │    a) …           │ ││
│        │ └──────────────────────────────────────────────────┘│ └───────────────────┘ ││
│        │ ┌(3) Post to your school's platform  Illustrative ──┐└───────────────────────┘│
│        │ │ [◉ Google Classroom  Not connected][○ No platform] │                         │
│        │ │ [  Microsoft Teams  Planned ][ Canvas  Planned ]   │                         │
│        │ │ [  Moodle  Planned ]                               │                         │
│        │ │ — state-specific panel (see table) —               │                         │
│        │ └──────────────────────────────────────────────────┘                          │
│        │ ┌(4) Delivery history ──────────────────────────────┐                         │
│        │ │ ✓ Student copy (PDF) · Browser print dialog  4:09 │                         │
│        │ │ ✓ Student copy (PDF) · Classroom · P2  Simulated  │                         │
│        │ └──────────────────────────────────────────────────┘                          │
└────────┴──────────────────────────────────────────────────────────────────────────────┘
```

| Region | Content and rules |
|---|---|
| 1 Library | Confirms where the resource lives (course › unit), its type and outcomes |
| 2 Downloads | Student copy (or "Printable exam") and answer key as separate files; Word marked planned; Letter or A4; school name. Printing uses the browser's print dialog ("Save as PDF" there); the history records that the dialog was opened, not that a file was saved |
| 3 Platform | Destination cards; planned platforms disabled with "Planned". Panel by state: see `07_lms_publishing_ux.md` for every state and its exact copy |
| 4 History | Every download and post, with time, place and result |
| 5 Preview | What students get (the print layout), the answer key, and a simplified, clearly labelled picture of the Classroom post (not Classroom's own screen) |

A resource that is not approved opens a gate instead: "Approve it before it goes anywhere", with Back to review, **Print a proof marked DRAFT**, and a link to an approved example.

**Responsive.** Below 1024 px the preview moves under the options. On phones, downloads and posting work; the preview is a tab.

**Prototype.** Functional and real: printing (student copy and key, Letter or A4, with the DRAFT watermark on proofs), the history, copying the admin note. Simulated and labelled: Google sign-in, class list, posting and every Classroom response.

Mockups: `09_mockups/10_deliver.png`, `11_deliver_connected.png`, `12_deliver_published.png`.

---

## Supporting screens

**Library.** Search, course, type and status filters; a list grouped by course › unit with kind, outcomes, edited date, last delivery and state; actions Review, Deliver or (in reuse mode) Reuse. Empty states for "nothing matches" and for courses not in the catalog. Mockup: `09_mockups/13_library.png`.

**Integrations.** One card per platform with its true state and the single next action; a capability table ("Yes", "To assess", "No: needs Google Forms"); "What Funza never touches". Mockup: `09_mockups/14_integrations.png`.

**Journey map** (prototype only). Links into every step and failure state, and the legend of what is real, simulated, sample and planned.
