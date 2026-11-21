# Funza development steps

**Funza Teacher Studio · v0.1 · 21 November 2026**

This is the order in which Funza gets built, from creating accounts to the final release. Each step lists what to do and how to know it's done. The *why* behind each choice is in [requirements and architecture](../03_design/02_requirements_and_architecture/requirements_and_architecture.md); the product is summarized in the [repo README](../../README.md).

## Where everything runs

| What | Where | Notes |
|---|---|---|
| Website and backend | **Vercel**, the existing Pro team "Aubino Chris' projects" (no new cost) | One Next.js app in `app/`. Its API routes are the Node.js backend. Functions run in Montréal (`yul1`). |
| Database | **Supabase Postgres**, Canada (Central) | Courses, chapters, drafts, versions, templates, question bank, live sessions, answers, AI usage. Row-level security on every table. |
| Files | **Supabase Storage**, Canada (Central) | Uploaded PDFs, past exams, images. |
| Teacher sign-in | **Supabase Auth** | Google, or a link sent by email. Students never sign in. |
| Live updates | **Supabase Realtime** | One channel per live session; pings only. |
| AI | **Gemini API** | Called only by the server, through `app/src/lib/ai/server.ts`. |
| Publishing | **Google Classroom API**, course page, print | Classroom works today. |
| Code and checks | **GitHub** (`Binborg1/Final-2027`) and GitHub Actions | Every pull request gets a Vercel preview and runs the tests. |

AWS is not used (decided 21 November 2026, Q11).

## Timeline

| Dates | Step | Release |
|---|---|---|
| 21 Nov | 0. Accounts and keys | R1 |
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
2. **Vercel.** In the Pro team "Aubino Chris' projects", import `Binborg1/Final-2027`, set the root directory to `app`, and keep the Next.js preset. In the project settings, set the function region to **Montréal (yul1)**. Add environment variables: the production Supabase keys for *Production*, and the dev keys for *Preview* and *Development*.
3. **Google Cloud.**
   - In the existing OAuth client (the one Classroom uses), add the Supabase callback URL for each project: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - In each Supabase project, under Auth → Providers → Google, enter that client ID and secret.
   - Create two Gemini API keys. The development key stays on the free tier and is used only with made-up data. The production key has billing on and a **US$10 monthly budget alert**.
4. **GitHub.** Optionally, protect `main` so changes arrive through pull requests with passing checks.

**Done when:** a Vercel preview builds the current app, and both Supabase projects exist in Canada.

## Step 1. Foundation (21–22 Nov)

1. Install the Supabase CLI, run `supabase init` in `app/`, and write the first migration. It holds the 15 tables and 3 join tables from Diagram 4, with row-level security on each. Apply it to `funza-dev`.
2. Add `src/lib/db/` with three Supabase clients:
   - **Browser:** uses the public key.
   - **Server:** reads the teacher's session from cookies.
   - **Admin:** uses the service role key, server only, for student writes and scheduled jobs.
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

1. Build the sign-in page (Google, or an email link) and the callback route.
2. Protect teacher pages so they need a session. Student pages stay public.
3. On first sign-in, create the `teachers` row and show first-time setup: grades, subjects and courses.

**Done when:** you can sign in on the Vercel preview and land on an empty Home.

**Bazaar (24 Nov):** show the plan documents, plus sign-in and Make working on the deployed app.

## Step 4. Courses, Make and the bank in the database (24–25 Nov)

1. Courses and chapters: create, rename, reorder and delete. New chapters start from the curriculum units.
2. Sources: upload to Storage, extract the text once, and attach the source to its chapter.
3. Move `lib/resources/store.ts` from local storage to Supabase: drafts, versions, and approve, which locks a version.
4. AI:
   - Gemini becomes the default, with the current Flash model.
   - Every call goes through the daily allowance (`FUNZA_AI_DAILY_LIMIT`, default 40) and is logged in `ai_usage`.
   - Long drafts stream to the screen.
5. Approving saves the questions to the chapter's bank.
6. On first sign-in, offer to import drafts saved in that browser.

**Done when:** a teacher makes and approves a quiz on one computer and finds it on another.

## Step 5. Live mode (26–28 Nov)

1. Build `lib/live`: session states, 6-character codes, the server clock, and exact marking. Start the exact marking from the checker in git (`c611d8f^`).
2. API routes: `/api/live/start`, `join`, `state`, `answer`, `close`, `reveal`, `end`.
3. Realtime pings on one channel per session. If the WebSocket can't connect, phones ask for the state every 2 seconds.
4. Teacher screens:
   - Funza suggests questions, and the teacher picks them.
   - Timer and lobby (projector).
   - Console: names, answer count, close early.
   - Reveal (projector).
   - Results with the most-missed questions, and a CSV export.
5. Student screens: `/join` (code, name, student number) and `/play/[session]` (answer, wait, see my result).
6. Short-answer marking: one Gemini call per question, with no names. The teacher can flip any mark.
7. Rate limits on join, answer and state.

**Done when:** 5 real phones and 35 simulated ones finish a session with no lost answers. Every phone shows the question within 1 second of the click.

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

**Done when:** production runs a full live session and a full Prepare flow. **1 December: Release 1 and Vlog 2.**

---

## Release 2 (January to April 2027)

| Step | What | Target |
|---|---|---|
| 8 | **Templates:** describe a format, upload a past exam (Gemini reads it, scans included), or save the builder's controls. Pin questions to a template. | January |
| 9 | **Bank reuse:** drafts take from the bank first and Funza writes only the gaps, with the 60-day repeat rule and a bank page per chapter (search, edit, retire, pin). | January–February |
| 10 | **Difficulty from live results**, shown after at least 10 answers. | February |
| 11 | **Funza chat edits**, each change saved as a new version. | February |
| 12 | **Notes templates** and **practice sets from weak spots**. | February–March |
| 13 | **Classroom on the account:** the Google token moves from a cookie to `google_connections`, encrypted. | March |
| 14 | **Pilot with real teachers:** check privacy needs with the division, add Sentry, decide on Supabase Pro, and fix what the pilot finds. | March–April |
| | **Release 2** | 9 April 2027 (tentative) |
