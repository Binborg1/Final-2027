# Library: every approved material, with its history
**Funza Teacher Studio · v0.2 · 24 November 2026**

*Changed in v0.2: deleting an approved material, and deleting and bringing back curriculum chapters (section 8).*

The sidebar's **Question bank** item, a disabled placeholder until now, becomes **Library**: one page that keeps every material the teacher has approved, in every course, with every approved version. Each course's **Materials** card shows the same materials for that course. Any approved material opens in a read-only view, where the teacher can switch between the teacher copy and the student copy, print it, and see its history.

The question bank does not move. Approved questions stay in each chapter's bank on the chapter page (FR-27, FR-29).

## 1. Decisions

Decided by the team on 24 November 2026:

| Question | Decision |
|---|---|
| Name | **Library** in the sidebar. Inside a course, the card stays **Materials**, so the two names never clash. |
| What goes in | Every kind: notes, slides, quizzes, unit tests and exams, in one list. Chips filter it by kind (All · Notes · Slides · Quizzes · Unit tests · Exams). |
| Bank questions | Not in the Library. The bank stays per chapter. |
| A course's Materials card | Approved materials first, each opening the read-only view. Drafts never approved sit underneath under **Still in review**, opening Review as before. |

## 2. Logic

**What is in the Library.** A material is in the Library once it has at least one approved version. The Library doesn't read `resources.status`, because `status` describes the *current* version: when the teacher starts version 2 of an approved material, `status` goes back to `draft`, but version 1 is still approved and must stay in the Library.

**Which version it shows.** The latest approved version. The read-only view can open any older approved version (`?v=1`). Drafts are never shown in the Library; they stay in Review.

**A newer draft.** Versions after an approval always start from the approved one (`startMaterialVersion`), so a draft that follows an approval is always numbered *latest approved + 1*. The row then says "v3 in review", and the view offers **Open draft v3** instead of **Open in Review**.

**State chip.** **Published** when the material's current version is published (`status = 'published'`), otherwise **Approved**. The view's history lists every post and print of each version from `publications`.

**Actions in the view**, with one primary action:

| Action | When | Where it goes |
|---|---|---|
| **Print or save as PDF** (primary) | Always | `/make/[id]/print?v=N`: the student copy of the version on screen, built on the server from that frozen version |
| **Open in Review** | No newer draft | `/make/[id]`, where the teacher can start a new version or publish |
| **Open draft vN** | A newer draft exists | `/make/[id]` |
| **Run live** | Quizzes, tests and exams, when the version on screen is the current version | `/live/new?quiz=[id]` (Live uses the current version, so a draft would have no questions) |

**Never approved.** Opening `/library/[id]` for a material that has no approved version sends the teacher to Review.

**Rules that still hold.** Nothing here changes what reaches students: the student copy is the same server-built copy as before, and it is built only from an approved version. The view is read-only; editing still starts a new version in Review.

## 3. Data

**No schema change and no migration.** The Library is a read model over tables that already exist:

| Table | What the Library reads |
|---|---|
| `resource_versions` | `id, resource_id, number, approved_at` of the approved versions (without `content`, which is large). The latest per resource is the one shown. |
| `resources` | `id, title, kind, status, course_id, current_version_id, updated_at` |
| `resource_chapters`, `chapters`, `courses` | Chapter and course names |
| `resource_versions.content` | Only for the version on screen in the read-only view |
| `publications` | `version_id, channel, published_at` for the material's versions (the view's history) |

**Who can read it.** Every query runs with the teacher's own session, so row-level security (`teacher_id = auth.uid()` on every table above) returns only the teacher's rows. No new policies are needed.

**Cost.** The Library page makes four small queries (approved versions, resources, courses, chapters) and filters in the browser. The view makes four more (the resource, its versions, the shown version's content, its publications). The existing indexes cover them: `resource_versions (resource_id, teacher_id)`, `resources (course_id, teacher_id)`, `publications (version_id, teacher_id)` and the unique `(resource_id, number)`.

**Limit.** PostgREST returns at most 1,000 rows a query. That is about 1,000 approved versions per teacher, years of use. Paging is added if a teacher gets near it.

## 4. UI (F · Oak)

### Sidebar and shortcuts
- **Prepare** section: Home, Courses, Review, **Library** (lucide `Library` icon, `/library`), Templates.
- **Ask Funza (Ctrl K)** gains a **Library** shortcut: "Every material you approved, with its versions".
- **Home**, card "Waiting for review": the **Approved** rows open the read-only view, and a **See all in Library** link sits beside the "Approved" label.

### Library (`/library`)
- **Header:** "Library", one line ("Every material you approved, by course, with each version kept."), and the primary **Make something**.
- **Filters**, one row:
  - kind chips with counts: All · Notes · Slides · Quizzes · Unit tests · Exams (a kind with none is hidden);
  - a course select ("All courses"), shown when the teacher has more than one course;
  - a search field for titles (case and accents ignored).
  - The filters live in the address (`?kind=quiz&course=…&q=…`), so a course page can link to its own part of the Library and Back keeps the filters.
- **Groups:** one card per course, in the teacher's course order: the course title, a count and **Open course**.
  - **Rows:** a kind icon, the title, "Unit test · v2 · approved Nov 24 · Force and Motion in Our World", "v3 in review" when a draft follows, and the state chip. The row opens the view. Newest approvals first.
- **Empty:** "Nothing approved yet. When you approve a material in Review, it's kept here with every version." with **Make something**, and a link to the drafts waiting on Home when there are any.
- **No match:** "Nothing matches" with **Clear filters**.

### A material (`/library/[id]`, `?v=N`, `?view=student`)
- **Header:** crumbs "Library › {course} › {title}", the title of the version on screen, then the state chip, a "vN" pill, the kind, "N sections · N questions · N marks · N min" and "Approved November 24, 2026". Actions as in section 2.
- **Notices** (one line each):
  - an older version: "This is version 1. Version 2 is the latest approved." with **See version 2**;
  - a newer draft: "Version 3 is being edited in Review. This approved version stays as it is."
- **Left: the document** in a card, with two chips at the top: **Teacher copy** (default) and **Student copy**.
  - *Teacher copy:* everything: correct options marked "Correct" in sage (as in Review), answers, worked solutions, rubrics and slide speaker notes.
  - *Student copy:* what students get: no answers, keys, solutions, rubrics or speaker notes, with answer lines where students write.
  - Quizzes, tests and exams: "Part A: {section} (N marks)", instructions in italics, numbered questions with their marks, numbering as the template says (straight through or per section).
  - Notes: each section's heading, paragraphs and bullet lists, then any check questions.
  - Slides: one tile per slide ("Slide 3"), its bullets, and its speaker notes in the teacher copy.
- **Right column:**
  - **Versions:** each approved version, newest first: "v2 · Approved Nov 24", with "Posted to Google Classroom" or "Printed" under it, opening that version; the one on screen says "Showing". A newer draft is listed first as "v3 · Draft in Review", opening Review.
  - **Details:** course (opens the course page), chapters (each opens its chapter page), outcome codes and the date it was first made.

### A course and a chapter (`/courses/[id]`, `/courses/[id]/chapters/[chapterId]`)
- **Materials card:**
  - approved materials first, with the latest approved version, its date and the state chip, each opening the view;
  - then **Still in review**: drafts never approved, opening Review;
  - **See all in Library** in the card header opens `/library?course={id}`.

## 5. Code

| File | Change |
|---|---|
| `src/lib/library/model.ts` | New, pure and tested: latest approved version per material, the draft that follows it, the kind filters, filtering and grouping by course, splitting a course's materials, a version's history, and splitting text into paragraphs, bullets and speaker notes |
| `src/lib/library/data.ts` | New, server only: `libraryRows()` for the Library and `libraryItem(id, v)` for the view |
| `src/app/(studio)/library/page.tsx`, `LibraryBrowser.tsx` | New: the Library page, and its filters and groups in the browser |
| `src/app/(studio)/library/[id]/page.tsx`, `MaterialDocument.tsx` | New: the read-only view and the document renderer |
| `src/components/shell/nav.ts`, `CommandDialog.tsx` | Library replaces the disabled Question bank item; the Ctrl K shortcut |
| `src/lib/courses/data.ts`, `src/app/(studio)/courses/Materials.tsx` | Materials rows carry their latest approved version; the card splits approved from still in review |
| `src/app/(studio)/WaitingForReview.tsx` | Approved rows open the view; See all in Library |
| `src/lib/resources/student-copy.ts`, `make/[id]/print/route.ts` | Print a chosen approved version (`?v=N`); without it, the current version as before |
| `src/components/ui/Chip.tsx` | The chip recipe as a class helper, so links can look like chips |
| `tests/library.test.ts` | New |

## 6. Done when
- The sidebar shows **Library**, and it opens `/library`.
- Approving a material in Review puts it in the Library and at the top of its course's Materials card, without a reload.
- Starting version 2 keeps version 1 in the Library, with "v2 in review"; approving version 2 shows version 2, and version 1 is still in Versions.
- A material never approved is not in the Library; its course card lists it under Still in review.
- The view's student copy has no answers, keys, solutions, rubrics or speaker notes, and **Print** prints the version on screen.
- Another teacher's material id gives "not found".
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.

## 7. Not in this version
- Reusing a material as the start of a new one ("Use as a starting point"), which the earlier app's library had.
- Archiving, or restoring a deleted material: a delete is for good (section 8).
- A bank page across chapters (FR-29 stays per chapter, Release 2).
- Showing on the course page which version students have, when a Classroom post was saved as a draft. `publications` doesn't record draft or live yet.

## 8. Deleting materials and chapters (v0.2)

Asked for on 24 November 2026: the teacher can delete approved materials in the Library, and the chapters a course was preloaded with, so they control what's in their account.

**Decisions** (the team, 24 November 2026):

| Question | Decision |
|---|---|
| What a delete does | Removes the teacher's own copy for good, after a confirm dialog. Nothing shared changes: the Saskatchewan curriculum is a file in the repo, and every row deleted belongs to that teacher (row-level security). No restore and no schema change. |
| Bank questions of a deleted quiz, test or exam | Retired: they stay in the database but aren't offered for new drafts or Live. A question another material still uses stays active. |
| Preloaded chapters | Deletable like any chapter. A deleted curriculum chapter can be brought back from the curriculum. |

**Deleting a material** (`deleteMaterial`, from **Delete this material** in the Library view):
1. Reads the questions its versions used (`version_questions`).
2. Deletes the resource. Its versions, chapter links, `version_questions` and `publications` go with it (foreign keys `on delete cascade`). A live session that ran it keeps its results; its link to the version becomes empty (`on delete set null`).
3. Retires the questions no other material's version uses (`questionsToRetire`). Template pins of those questions stay.
- Copies already printed, or posted to Google Classroom, are outside Funza and stay where they are. The dialog says so.

**Deleting a chapter** (`deleteChapter`, already on the course page): removes the teacher's chapter row. Its bank questions are retired by the existing trigger, materials made from it are kept, and its sources go with it.

**Chapters no longer come back on their own.** Until now, a curriculum course with no chapters was given its chapters again whenever it was opened (`courseDetail`) or the Courses and Make pages loaded (`ensureChapters`). A teacher who deleted every chapter saw them all return. Chapters are now added only when the course is made, in setup or "Add a course", which both already did. `ensureChapters` is removed.

**Bringing chapters back** (`restoreChapters`):
- `removedCurriculumChapters` compares the curriculum's chapters at the course's level (`chapterSeeds`) with the course's chapters. A unit, module or outcome chapter is matched by its curriculum reference (`source_ref`), so a renamed one still counts as present. Chapters named after the curriculum document have no reference and are matched by title.
- The course page shows **Bring back curriculum chapters (N)**. The dialog lists them with checkboxes; the chosen ones are added at the end, in curriculum order, with their outcomes. The server recomputes what is missing and adds only those, so a double click or a second tab can't add a chapter twice (the unique index on `course_id, source_ref` backs this up).
- Their old questions stay retired; the bank fills again as new materials are approved.

**Tests:** `missingSeeds` and `seedKey` (`tests/courses.test.ts`), `questionsToRetire` (`tests/library.test.ts`).
