# Funza development steps

**Funza Teacher Studio · v0.7 · 24 November 2026**

*Changed in v0.7: templates (Release 2 item 8, and the notes templates of item 12) are built early; pins and saving the controls stay in Release 2. Make's Type change now keeps the course and chapters. v0.6: the step 3 sign-in settings are set on the development project; the email templates wait for a custom SMTP sender, and reset links from the default template work in the browser that asked. v0.5: step 5 (Live mode) is built; the whole set runs at once on one shared timer, and the migrations for steps 4 and 5 are applied to the development project. v0.4: step 4 is built (courses and chapters, drafts and approval in the database, the question bank, the daily AI allowance); the chapter rule is decided. v0.3: teacher sign-in is Google, or email and password, instead of an email link (step 3).*

This is the order in which Funza gets built, from creating accounts to the final release. Each step lists what to do and how to know it's done. The *why* behind each choice is in [requirements and architecture](../03_design/02_requirements_and_architecture/requirements_and_architecture.md); the product is summarized in the [repo README](../../README.md).

## Where everything runs

| What | Where | Notes |
|---|---|---|
| Website and backend | **Vercel**, the existing Pro team "Aubino Chris' projects" (no new cost) | One Next.js app in `app/`. Its API routes are the Node.js backend. Functions run in Montréal (`yul1`). |
| Database | **Supabase Postgres**, Canada (Central) | Courses, chapters, drafts, versions, templates, question bank, live sessions, answers, AI usage. Row-level security on every table. |
| Files | **Supabase Storage**, Canada (Central) | Uploaded PDFs, past exams, images. |
| Teacher sign-in | **Supabase Auth** | Google, or email and password. Students never sign in. |
| Live updates | **Supabase Realtime** | One channel per live session; pings only. |
| AI | **Gemini API** | Called only by the server, through `app/src/lib/ai/server.ts`. |
| Publishing | **Google Classroom API**, course page, print | Classroom works today. |
| Code and checks | **GitHub** (`Binborg1/Final-2027`) and GitHub Actions | Every pull request gets a Vercel preview and runs the tests. |

AWS is not used (decided 21 November 2026, Q11).

## Timeline

| Dates | Step | Release |
|---|---|---|
| 21 Nov | 0. Accounts and keys | R1 |
| 21 Nov | Cleanup and first security fixes ✅ | R1 |
| 21–22 Nov | 1. Foundation: schema, database clients, CI | R1 |
| 21–23 Nov | 2. UI design (alongside step 1) | R1 |
| 23 Nov | 3. Teacher sign-in | R1 |
| 24 Nov | Bazaar demo | |
| 24–25 Nov | 4. Courses, Make and the bank in the database | R1 |
| 26–28 Nov | 5. Live mode | R1 |
| 29 Nov | 6. Course page | R1 (moves to R2 first if short on time) |
| 30 Nov | 7. Test and release | R1 |
| **1 Dec** | **Release 1 and Vlog 2** | |
| Jan–Apr 2027 | 8–14. Release 2 | R2 |
| **9 Apr 2027** | **Release 2, end of ENSE 477** (tentative) | |

---

## Step 0. Accounts and keys (21 Nov, about 2 hours)

Done in browsers by a team member; nothing here is code.

1. **Supabase.** ✅ *Done 21 Nov.* The team's Funza Google account owns the organization. Its project **Funza** (`oitifuxpuxsbzubokukn`) is in **Canada (Central)**, with automatic row-level security on new tables, and API access granted table by table. Still to do:
   - Aubin and Chop share the Funza account's login, kept in a shared password manager with two-step verification on.
   - Use this project for development and the R1 demo. Create a separate production project before the first real class.
   - The connector `funza-supabase` (in `.mcp.json`) gives agents read and write access to this project only.
2. **Vercel.** In the Pro team "Aubino Chris' projects", import `Binborg1/Final-2027`, set the root directory to `app`, and keep the Next.js preset. In the project settings, set the function region to **Montréal (yul1)**. Add environment variables: the production Supabase keys for *Production*, and the dev keys for *Preview* and *Development*. **Don't add a Gemini key to any Vercel environment until step 3 is merged:** until then `/api/teach` answers anyone who finds the URL.
3. **Google Cloud.**
   - In the existing OAuth client (the one Classroom uses), add the Supabase callback URL for each project: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - In each Supabase project, under Auth → Providers → Google, enter that client ID and secret.
   - Create two Gemini API keys. The development key stays on the free tier and is used only with made-up data. The production key has billing on and a **US$10 monthly budget alert**.
4. **GitHub.** Optionally, protect `main` so changes arrive through pull requests with passing checks.

**Done when:** a Vercel preview builds the current app, and both Supabase projects exist in Canada.

## Cleanup and first security fixes (21 Nov) ✅

The earlier teacher workspace's screens are gone, because Teacher Studio gets a new design (step 2). Its logic stays in `app/src/lib/`, and the ideas from the removed screens are written up in [concepts from the earlier app](04_concepts_from_the_earlier_app.md). The curriculum data was left as it is (see step 4).

- **Removed:** every old page and component, the visualization engine (except the expression engine, now `lib/math/expr.ts`), the lesson plan, worksheet, homework and interactive-graph kinds, the Anthropic provider and image input, `framer-motion` and `@anthropic-ai/sdk`.
- **Tooling:** Tailwind now runs through the standard PostCSS plugin; `pdfjs-dist` is pinned to the version of its worker in `public/`; tests can load `lib/ai/server.ts`.
- **Security fixed:**
  - The Gemini key goes in a request header, not the URL.
  - What a provider says in an error stays in the server log; the teacher sees a plain message.
  - AI calls time out after 2 minutes, and blocked or cut-off Gemini replies are named.
  - An uploaded file can no longer close the `<material>` wrapper that marks it as data.
  - The AI status check no longer reveals the model.
  - Cross-site POSTs to the Classroom routes are refused, including those with a missing or malformed `Origin`.
  - Server-only modules (AI, Classroom session, curriculum file) fail the build if a browser page imports them.
  - Classroom publishing moved out of the old screen into `lib/lms/publish.ts`, with tests.

Still open, and scheduled below: sign-in on `/api/teach` and the Classroom routes (step 3), the Classroom cookie tied to a teacher (step 3), the daily AI allowance (step 4), approval enforced on the server (step 4), and the Classroom Doc built from a saved version (step 4).

## Step 1. Foundation (21–22 Nov)

1. Install the Supabase CLI, run `supabase init` in `app/`, and write the first migration. It holds the 15 tables and 3 join tables from Diagram 4, with row-level security on each. Apply it to the development project, **Funza** (`oitifuxpuxsbzubokukn`).
2. Add `src/lib/db/` with three Supabase clients:
   - **Browser:** uses the publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
   - **Server:** reads the teacher's session from cookies.
   - **Admin:** uses the secret key (`SUPABASE_SECRET_KEY`), server only, for student writes and scheduled jobs.
3. Generate TypeScript types from the schema.
4. Add Zod, and check the environment variables when the app starts.
5. Add `.github/workflows/ci.yml` to run lint, type checks and `npm test` on every pull request.
6. Add the scheduled clean-up job (pg_cron), which deletes student names, numbers and answers 30 days after a session.

**Done when:** a pull request shows green checks, and its Vercel preview reads from the dev database.

## Step 2. UI design (21–23 Nov, alongside step 1)

1. Agree the look and feel.
2. Design the screens Release 1 needs:
   - **Teacher:** sign-in, first-time setup, Home, courses, the course page with chapters, the Make box, review and approve.
   - **Live:** pick questions and timer, the lobby (projector), the live console, reveal and results (projector).
   - **Students:** join, answer, my result, the course page.
3. List the shared parts (buttons, chips, cards, the stepper, tables, empty states).

**Done when:** the team signs off on the screens. The designs go in `docs/03_design/03_ui_design/` as Markdown with images.

## Step 3. Teacher sign-in (23 Nov)

1. ✅ Build the sign-in page and the callback routes. *Built on branch `sign-in`: `/sign-in`, `/auth/callback` (Google), `/auth/confirm`, `/auth/sign-out`.*
   - ✅ **Changed 23 Nov:** Google stays the first button. Below it is an email and password form with "Create account" and "Forgot password?". The email sign-in link is gone. Passwords need at least 8 characters, checked in the page, in the server and by Supabase.
   - `/auth/confirm` takes the two links Funza emails: confirm a new account, and reset a password. Both work across devices. A reset link opens `/new-password` ("Choose a new password"), which Settings also links to as "Change password".
2. ✅ Protect teacher pages so they need a session. Student pages stay public. *`src/proxy.ts` refreshes the session and redirects signed-out visitors; every page, Server Function and API route checks again itself (`src/lib/auth/`). Public: sign-in, `/auth/*`, `/join`, `/play/*`, `/c/*`, `/api/health`, `/api/curriculum/*`.*
3. ✅ On first sign-in, create the `teachers` row and show first-time setup: grades, subjects and courses.
4. ✅ `/api/teach` and every `/api/lms/google/*` route answer 401 without a signed-in teacher.
5. ✅ Tie the Classroom cookie to the teacher: seal the teacher's id into it, refuse it for anyone else, and delete it on sign-out.
6. Only after this step is merged, add the Gemini development key to Vercel's *Preview* environment.
7. Supabase settings on the development project (dashboard):
   - ✅ Authentication → URL Configuration (set 23 Nov): Site URL `https://funza-rose.vercel.app`; Redirect URLs `https://funza-rose.vercel.app/**`, `http://localhost:3000/**` and `https://*-aubino-chris-projects.vercel.app/**`.
   - ✅ Authentication → Sign In / Providers → Email (set 24 Nov): Email on, minimum password length **8**, "Confirm email" **off** for the bazaar so a visitor can make an account on the spot.
   - ✅ Realtime → Settings: public access is on (checked 24 Nov with a broadcast on a public channel).
   - Authentication → Emails: Supabase lets a project edit its templates only once it has a custom SMTP sender (step 7, item 5), so the default templates stay for now. Their links come back to `/auth/confirm` with a one-time code, which works in the browser that asked; another browser gets "Sign-in started in another browser". With the custom sender, the "Confirm signup" template links to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` and "Reset password" to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`, and the links work on any device. The "Magic link" template is no longer used.

Also in this step: the F · Oak design system and page shell ([UI design](../03_design/03_ui_design/ui_design.md)), Home, Settings, and Make (brief, draft, review, approve) on the new design. Drafts stay in the browser, now kept per teacher, until step 4.

**Done when:** you can sign in on the Vercel preview with Google, or create an email and password account, and land on an empty Home; a forgotten password can be reset from the sign-in page; and a signed-out request to `/api/teach` gets 401.

**Bazaar (24 Nov):** show the plan documents, plus sign-in and Make working on the deployed app.

## Step 4. Courses, Make and the bank in the database (24–25 Nov)

Built on branch `step-4-courses-and-bank` (23 November). The migration `step4_courses_and_bank` adds unique seeded chapters, question fingerprints and `approve_version()`.

1. ✅ Courses and chapters: create, rename, reorder and delete, on `/courses`, `/courses/[id]` and the chapter page. New chapters start from the curriculum.
   - **Chapter rule (decided 23 Nov):**
     - one chapter per curriculum unit with outcomes at the course's level;
     - one per Practical and Applied Arts module;
     - one per outcome where the curriculum has neither (all 9 Mathematics courses);
     - chapters named after the curriculum document's units, or a single "Chapter 1", where there are no web outcomes.
     - The teacher renames, reorders or deletes them.
   - Chapters are seeded in setup, on "Add a course", and the first time an older course opens. They store the dataset's outcome ids (Science 10's SCI10-FM2 is `sk-63-110477`).
   - ✅ Removed (23 Nov): the Science 10 hand-copied entry and its `lessonTemplate` rule (the import has the same words and adds the indicators; the starter bank now uses the dataset ids), the lesson-plan content in `bank.ts`, and `scripts/curriculum/schema.sql` and `export-sql.mjs`.
2. ✅ Sources: upload to Storage, extract the text once, and attach the source to its chapter.
   - Files go to the private `sources` bucket under the teacher's own folder (migration `chapter_sources_storage`; row-level security on `storage.objects`). The text is read once in the browser (pdf.js) and kept in `sources.text`.
   - The chapter page lists, opens and deletes sources. Make offers a chosen chapter's sources as "my notes".
3. ✅ `lib/resources/store.ts` saves to Supabase. The browser keeps the working copy and saves each change through Server Functions (`lib/resources/actions.ts`). The draft is a resource version's `content`. Approving locks the version; editing starts the next one.
4. AI:
   - ✅ Every call goes through the daily allowance (`FUNZA_AI_DAILY_LIMIT`, default 40, counted from midnight Saskatchewan time) and is logged in `ai_usage` with its tokens. Make says how many are left when 5 or fewer remain.
   - ✅ Long drafts stream: Make shows "Funza has started 7 of 12 questions" while Gemini writes. Only a count is streamed; the reply is validated whole, as before. Gemini 2.5 Flash stays the default model.
5. ✅ Approving saves the questions to the chapter's bank. **Approval is enforced on the server:** it reruns the checks on the saved copy and refuses while anything has failed, waits on the teacher or changed since review. `approve_version()` then approves the version and upserts its questions in one transaction. Unchanged questions keep their bank row.
6. On first sign-in, offer to import drafts saved in that browser. *Dropped: only test drafts existed.*
7. ✅ Publishing to Classroom builds the Google Doc on the server from the saved approved version, found by its id; the browser sends only the id. Review has a Publish panel for approved versions: print or save as a PDF (`/make/[id]/print`, the same server-built student copy), or post to chosen Classroom classes as a draft or live. Each post is recorded in `publications`.
8. ✅ Gemini replies are requested as JSON, `complete()` returns token counts, and `/api/teach` sets `maxDuration = 150`.

**Done when:** a teacher makes and approves a quiz on one computer and finds it on another, with its questions in the chapter's bank.

## Step 5. Live mode (26–28 Nov)

**Decided (23 November 2026):** the whole set runs at once on one shared timer (5:00 by default; the exit-ticket preset is 3 questions in 3:00). Students answer in any order. At Reveal the projector steps through the questions one at a time. No Pause and no leaderboard in R1. The projector never shows names; names are on the console only (Figma L1: "Shown to you, never on the projector").

1. ✅ `lib/live`: session states, 6-character codes, the server clock, and exact marking.
   - The join-code generator and its test are restored from `c611d8f^` (`lib/classes/model.ts`); the alphabet leaves out 0, O, 1 and I.
   - The answer checker is new. Numbers use a strict parser (no expressions, no commas; a trailing unit must match the key's) and the 0.5% / 0.01 tolerance, against the recomputed calculation or the key as written.
   - Each phone's token is stored as a SHA-256 hash and compared in constant time (the `keyMatches` pattern in `c611d8f^`).
   - States: `lobby → open → closed → revealed → ended`. The first request after the end time plus 2 seconds closes the session if the console is gone. Every change raises a revision number and is a conditional update, so two tabs can't both apply it.
2. ✅ API routes.
   - Phones (public, a token in the `x-funza-token` header): `/api/live/join`, `/api/live/state`, `/api/live/answer`.
   - Teachers (signed in, same site for POSTs, row-level security): `/api/live/start`, and `/api/live/[id]` with `open`, `close`, `mark`, `marks`, `reveal`, `end`, `remove` and `csv`.
   - Route logic is in `lib/live/handlers/`, tested against an in-memory store.
3. ✅ Realtime pings on two public broadcast topics per session, named by its random id: `live:<id>` (state changes, for phones, the console and the projector) and `live:<id>:teacher` (answers, the roster, marks, the projector's step). Pings carry only the revision number. If the WebSocket isn't up within 3 seconds, screens ask every 2 seconds; while connected they still check every 15.
4. ✅ Teacher screens (Figma "F · Live screens"):
   - Setup (L1, `/live/new`): questions from the chapter's bank, Funza's suggestions (also from a chapter source, with "+3 more", "Easier" and "Harder"), a saved approved quiz or the exit-ticket preset. Questions Funza wrote or the teacher edited are saved as an approved quiz through the same server checks as Make, so every live question is a bank question with its key snapshotted.
   - Console (`/live/[id]`): the lobby with the code, QR code and names; answering (L2); check marks (L3); Reveal.
   - Projector (`/live/[id]/screen`, no shell): the lobby's QR code and code, the clock at 144 px, then each revealed question at 40 px.
   - Results (L5, `/live/[id]/results`): class average, by outcome, the most-missed questions with their most common wrong answer, student scores and the CSV export. `/live` lists every session.
   - Entry points: Home's "Go live", the sidebar, the command menu, chapter pages, and "Run live" on approved quizzes in Review.
5. ✅ Student screens: `/join` (code from the QR code, name, student number if asked) and `/play/[session]` (wait, answer one question per screen, see my result). Answers save as the student goes, the newest one wins, and unsent answers survive a reload.
6. ✅ Short-answer marking: once time is up, one Gemini call per question, with answers under random ids and no names, within the daily allowance (logged as `live-mark`). The teacher can change any mark and undo the change. If Funza can't mark, the answers stay unmarked for the teacher.
7. ✅ Rate limits in Postgres (`rate_hit()`): joining 10 a minute per phone and 100 per network address, state 60 a minute per token, answers 60 a minute per token (up from 30: text answers save after a pause, and retries count). 60 students per session, 2 open sessions per teacher. Every state-changing route refuses cross-site requests; `/api/teach` now does too.
8. ✅ Migration `live_mode` (applied 23 Nov 2026), pgTAP tests in `06_live_mode`, and `scripts/live-load.mjs` for the load test.

**Done when:** 5 real phones and 35 simulated ones (`npm run live:load -- --base <preview> --code <code> --phones 35 --realtime …`) finish a session with no lost answers, and every phone shows the questions within 1 second of the click. *Still to run on a preview with real phones.*

## Step 6. Course page (29 Nov)

1. Publish an approved version to the course page. Show its link and QR code, and let the teacher reset the link.
2. Students open `/c/[link]` and see published material only.

**Done when:** a phone opens the course page from the QR code and downloads a published quiz. This is the first step to move to R2 if time is short.

## Step 7. Test and release (30 Nov)

1. Run the 40-phone script against a preview and check the speed and lost-answer targets.
2. Security tests:
   - Teacher B can't read teacher A's rows.
   - A phone can't use another student's token.
   - No answer key appears before Reveal.
3. Test on iPhone Safari, Android Chrome and a Chromebook, and on a school-like network.
4. Apply the migrations to `funza-prod`, merge to `main`, and check the production deployment.
5. In `funza-prod`, set up a custom SMTP sender (for example Resend), set the two email templates to the token-hash links (step 3, item 7), and turn "Confirm email" on, so confirmation and reset emails reach any teacher, and nobody can make an account with an address that isn't theirs.

**Done when:** production runs a full live session and a full Prepare flow. **1 December: Release 1 and Vlog 2.**

---

## Release 2 (January to April 2027)

| Step | What | Target |
|---|---|---|
| 8 | **Templates:** describe a format, upload a past exam (Gemini reads it, scans included), or save the builder's controls. Pin questions to a template. *Built early on 24 Nov: describe it, upload a PDF or text example, or set it up by hand, for quizzes and tests, exams, notes and slides; Make's Format panel offers Adjust or Template. Then the same day: Word and PowerPoint examples, Funza materials as examples, saving Make's settings, duplicating, pinned questions, printing in the template's style, and saving review changes back. Still to come: scanned pages.* | January |
| 9 | **Bank reuse:** drafts take from the bank first and Funza writes only the gaps, with the 60-day repeat rule and a bank page per chapter (search, edit, retire, pin). | January–February |
| 10 | **Difficulty from live results**, shown after at least 10 answers. | February |
| 11 | **Funza chat edits**, each change saved as a new version. | February |
| 12 | **Notes templates** and **practice sets from weak spots**. | February–March |
| 13 | **Classroom on the account:** the Google token moves from a cookie to `google_connections`, encrypted. | March |
| 14 | **Pilot with real teachers:** check privacy needs with the division, add Sentry, decide on Supabase Pro, and fix what the pilot finds. | March–April |
| | **Release 2** | 9 April 2027 (tentative) |
