# Funza Teacher Studio: the app

The Next.js app for **Funza Teacher Studio**: Prepare and Live modes for Saskatchewan Grade 10–12 teachers. What it must do is in [requirements and architecture](../docs/03_design/02_requirements_and_architecture/requirements_and_architecture.md), and the build order is in the [development steps](../docs/04_development/01_development_steps.md).

**State on 21 November 2026 (development step 3).** Teachers sign in with Google or an email link, go through first-time setup (grades, subjects, courses), and land on Home. Make works on the new F · Oak design: brief, AI draft, review, approve. Drafts are kept in the teacher's browser until development step 4 moves them to the database. The design and its tokens are described in [UI design](../docs/03_design/03_ui_design/ui_design.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Checks: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Tests use Node's own test runner (Node 22.6 or newer).

## Sign-in

Teachers sign in through Supabase Auth: Google, or a one-time link sent by email. Students never sign in.

| Route | What it does |
|---|---|
| `/sign-in` | The sign-in page. `?next=/some/page` returns there afterwards (same-site paths only) |
| `/auth/callback` | Google comes back here; the one-time code becomes a session (PKCE) |
| `/auth/confirm` | The email link comes back here with a token hash; works even when the link is opened on another device |
| `/auth/sign-out` | POST only, from Funza's own pages: ends the session and deletes the Google Classroom cookies |
| `/setup` | First-time setup. Every teacher page sends a teacher here until setup is finished |

**Who can open what.** `src/proxy.ts` refreshes the session cookie on each request and sends a signed-out visitor on a teacher page to `/sign-in`. That is only a quick first check: every teacher page calls `requireTeacher()`, every Server Function `teacherForAction()`, and every API route `teacherForRequest()` (`src/lib/auth/`), which ask Supabase Auth. Signed-out API calls get `401`. Public, with no sign-in: `/sign-in`, `/auth/*`, `/join`, `/play/*`, `/c/*`, `/api/health` and `/api/curriculum/*` (the published Saskatchewan curriculum, with no teacher or student data).

**Supabase settings** (Authentication → URL Configuration): the Site URL is the production address, and the Redirect URLs include `http://localhost:3000/**`, the production address with `/**`, and a pattern for the Vercel previews such as `https://funza-*-<team-slug>.vercel.app/**`. For email links that work across devices, the "Magic Link" and "Confirm signup" templates link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`. Supabase's built-in email sender only reaches members of the Supabase organization, a few times an hour; real teachers need a custom SMTP sender.

## Configuration

Copy `.env.example` to `.env.local` (or set the variables in Vercel).

| Variables | What they turn on | Without them |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (required) | Teacher sign-in and the database. Use the `sb_publishable_…` and `sb_secret_…` keys, not the legacy anon and service_role keys | The server refuses to start and lists what is missing |
| `GEMINI_API_KEY` (Groq or OpenRouter can stand in during development) | AI drafting of whole materials and single questions | Drafts start from Funza's starter question bank (Science 10, SCI10-FM2 and FM3) or from empty parts |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FUNZA_SESSION_SECRET` | Publishing to Google Classroom | Classroom reports that it is not set up; printing still works |

`/api/teach` answers signed-in teachers only (development step 3). Put the free-tier development key in Vercel's *Preview* environment only once step 3 is merged, and only use it with made-up data.

Google Classroom setup (once per deployment):

1. In Google Cloud, enable the **Google Classroom API** and the **Google Drive API**.
2. Configure the OAuth consent screen with the scopes Funza requests: `classroom.courses.readonly`, `classroom.topics.readonly`, `classroom.courseworkmaterials`, `classroom.coursework.students` (needed to post assignments), `drive.file`. While the app is in Google's Testing mode, refresh tokens expire after 7 days.
3. Create an OAuth client of type **Web application** with the redirect URI `https://<your-site>/api/lms/google/callback` (and `http://localhost:3000/api/lms/google/callback` for development). The same client is entered in Supabase for teacher sign-in, with Supabase's own callback URL added.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a random `FUNZA_SESSION_SECRET` of at least 32 characters, then redeploy or restart.

## Where things are

| Path | What it holds |
|---|---|
| `src/app/layout.tsx`, `globals.css` | The root layout (Figtree, the background photo) and the F · Oak design tokens and frosted-glass utilities (Tailwind 4 through PostCSS) |
| `src/app/(studio)/` | The teacher pages inside the page shell: Home (`page.tsx`), Make (`make/`, the brief; `make/[id]/`, review), Settings |
| `src/app/sign-in/`, `src/app/setup/`, `src/app/auth/` | Sign-in, first-time setup, and the sign-in and sign-out routes |
| `src/proxy.ts` | Refreshes the Supabase session and redirects signed-out visitors on teacher pages (an optimistic check only) |
| `src/lib/auth/` | Who is asking: `teacher.ts` (pages and Server Functions), `api.ts` (API routes, 401), `routes.ts` (which paths are public), `redirect.ts` (safe return paths) |
| `src/lib/teachers/` | First-time setup rules (`setup.ts`), its Server Functions (`actions.ts`) and labels |
| `src/lib/make/` | Chapters for Make (curriculum units at a course's level) and the quick-prompt phrases |
| `src/components/ui/`, `src/components/shell/` | The shared parts (buttons, chips, cards, fields, dialogs) and the page shell (sidebar, top bar, Ask Funza, tab dock) |
| `public/backgrounds/` | The background photo and its pre-blurred copy, with the photo credit |
| `src/app/api/teach/` | AI drafting: checks each outcome against the curriculum, sends the model only those outcomes, and validates the reply before it leaves the server |
| `src/app/api/curriculum/` | The curriculum: course list, one course, search, outcomes |
| `src/app/api/health/` | Says whether the deployment reaches its database (`reachable` or `unreachable`, nothing more) |
| `src/app/api/lms/google/` | Google Classroom: connect, callback, status, classes, topics, create the student copy as a Google Doc, post, disconnect |
| `src/lib/ai/` | `server.ts`: the only code that calls the AI (Gemini first, key in a header, time limit, safe error messages). `resource-prompts.ts`: prompts, with uploaded text wrapped and defused as data. `json.ts`: reply parsing |
| `src/lib/db/` | The Supabase clients: `browser.ts` (publishable key, the teacher's session), `server.ts` (the teacher's session from the request cookies, for pages and Server Functions), `route.ts` (the same for Route Handlers, writing refreshed cookies onto the response), `admin.ts` (secret key, server only, for student writes and scheduled jobs), and `types.ts`, generated from the schema |
| `src/lib/env.ts`, `src/lib/env-server.ts`, `src/instrumentation.ts` | The environment variables, checked with Zod when the server starts |
| `db/` | The database: `schema.sql` (the current schema, generated), `supabase/migrations/` (one file per change, each named by its applied version), `supabase/tests/` (pgTAP tests of row-level security and the schema's rules) and a log of what was applied where. See [`db/README.md`](db/README.md) |
| `src/lib/resources/` | The material model (notes, slides, quiz, test, exam), the blueprint computed before any AI call, the starter bank, draft assembly, the review checks, validation of untrusted input, the student-copy renderer, and the browser store (`store.ts`, local storage until development step 4) |
| `src/lib/curriculum/` | The catalog and its checks (`catalog.ts`), the imported dataset on the server (`dataset.ts`) and in the browser (`client.ts`) |
| `src/data/curriculum/` | The imported curriculum (`sk.json`) and the import report (`sk-report.md`) |
| `scripts/curriculum/` | The importer, a PostgreSQL schema and an SQL exporter |
| `src/lib/lms/` | Google OAuth session (encrypted cookie), Classroom and Drive calls, the browser client, and `publish.ts` (one Doc posted to several classes) |
| `src/lib/math/expr.ts` | A safe calculator language that recomputes answer keys. Not for marking students' typed answers |
| `src/lib/pdf/extract.ts` | Reads a PDF's text in the browser with pdf.js (the worker in `public/` must match the pinned `pdfjs-dist` version) |
| `src/lib/origin.ts` | Refuses cross-site POSTs to cookie-protected routes |
| `tests/` | Curriculum, resources, Classroom, expression engine, environment, database-client, security, sign-in (`auth.test.ts`), API guard and Classroom cookie (`api-guard.test.ts`), setup and Make tests. `tests/helpers/auth.ts` makes real Supabase session cookies and answers Supabase Auth offline |

## Database

The schema, the migrations, their tests and the log of what was applied where are in [`db/`](db/README.md). With Docker running and the Supabase CLI installed:

```bash
npm run db:start     # local Postgres with every migration applied
npm run db:test      # pgTAP tests of row-level security and the schema's rules
npm run db:types     # regenerate src/lib/db/types.ts after a schema change
npm run db:schema    # regenerate db/schema.sql
npm run db:stop
```

CI runs the same tests on every pull request and fails if `src/lib/db/types.ts` doesn't match the migrations.

## How drafting and review work

| Step | What happens |
|---|---|
| Brief | The teacher's settings (kind, outcomes, question mix, marks, time, difficulty). A blueprint is computed by code (`src/lib/resources/blueprint.ts`) before any AI call |
| Draft | `/api/teach` re-checks each outcome and its fingerprint, sends the model only those ids and their wording, and validates the reply (`src/lib/resources/ai-reply.ts`). A reply citing any other outcome is rejected whole; malformed questions are dropped and listed |
| Review | Checks run on every change (`src/lib/resources/checks.ts`): complete questions, catalog outcomes only, rubric totals, answers recomputed by the expression engine, coverage. Every AI or bank part stays marked until the teacher reviews it; any edit returns it to review |
| Approve | Needs nothing failed and nothing waiting on the teacher. The approved version is frozen; edits start a new version |
| Publish | The student copy (`src/lib/resources/render.ts`) never contains answers, keys, worked solutions or rubrics. Classroom gets it as a Google Doc in the teacher's Drive, then a material or assignment per class, as a draft by default |

## Curriculum data

`src/data/curriculum/` holds every Saskatchewan Grade 10–12 curriculum, copied verbatim from the Ministry. It is generated, never edited by hand:

| File | What it holds |
|---|---|
| `sk.json` | All 135 English curricula: courses, units (each listing its outcomes), outcomes and indicators, practical and applied arts course configurations (the modules in each course level), the official grouping per course with evidence, and status flags (`legacy`, `preliminary`, `listedInMenu`, `notACurriculum`). Courses whose content exists only as a PDF carry it in `course.document` |
| `sk-fr.json` | The 159 French immersion and Fransaskois curricula, same shape, each with its English equivalent |
| `by-grade/grade-10.json`, `grade-11.json`, `grade-12.json` (and `by-grade/fr/`) | The courses available in each grade (10-, 20- and 30-level), with only that level's units, outcomes and modules. `sk-by-grade.md` is the readable overview |
| `documents/<id>.json` | Verbatim extractions from the official PDFs: the Social Studies, History, Native Studies, Geography and Economics guides, the 1992 sciences, Treaty Education 10–12 and the 2026 drafts. Each records the PDF's URL, filename, SHA-256 and page numbers |
| `evidence/` | Quotes and citations behind groupings, ELA themes, legacy flags and French–English equivalents |
| `sk-report.md`, `sk-fr-report.md` | Counts, cross-checks, and everything a person should look at, including source typos and discrepancies |

```bash
node scripts/curriculum/import-sk.mjs            # about an hour the first time; cached pages make re-runs fast
node scripts/curriculum/import-sk.mjs --offline  # rebuild from cached pages only
node scripts/curriculum/import-sk.mjs --refresh  # fetch every page again (when the Ministry changes something)
node scripts/curriculum/import-sk.mjs --lang=fr  # the French curricula, into sk-fr.json
node scripts/curriculum/import-sk.mjs --only=63  # one curriculum, by its curriculum.gov.sk.ca id
```

The importer reads the course list, each course's outcomes page, each outcome's own page and the course configuration pages on curriculum.gov.sk.ca (two requests at a time, under one a second), then compares every statement with the Ministry's CSV files on EDonline. It attaches the committed `documents/` extractions, checking each PDF's SHA-256 so a changed PDF is flagged for re-extraction; it never runs OCR itself. The extraction scripts are in `scripts/curriculum/documents/`. At the end it writes the per-grade files (`scripts/curriculum/split-by-grade.mjs`). Raw pages are cached in `.cache/curriculum/` (not committed).

Document-sourced text has its own statuses: `document-extracted` (a PDF with a real text layer) and `document-ocr-unverified` (a scanned guide read by OCR; uncertain items are flagged one by one, and nobody has proofread them yet). History 30 is only partly extracted. Math and 13 other courses have no official grouping: the Ministry leaves the order and grouping of outcomes to the teacher.

| Status | Meaning | Usable |
|---|---|---|
| `cross-checked` | Copied automatically; the Ministry CSV has the same words | Yes, labelled "Imported · matches CSV" |
| `imported` | Copied automatically; no CSV, or the CSV words it differently (the note says how) | Yes, labelled "Imported" |
| `source-checked` | Copied by a team member (Science 10 FM1–FM4) | Yes |
| `verified` | Compared with the official page by a second person | Yes (none yet) |

No person has checked the imported text, so the review checklist asks the teacher to confirm it before approval. The app reads only `sk.json` today; the French data, the per-grade files and `course.document` are ready for when the app uses them. The Ministry's reuse terms for the wording are still to be confirmed.

## Security: what is in place and what is still open

In place: teacher sign-in checked on every teacher page, Server Function and API route (not only in the proxy), with `401` for signed-out API calls; return paths after sign-in limited to this site; AI keys only on the server; teacher files treated as data in prompts; AI replies rebuilt field by field; the Google token in an AES-256-GCM encrypted, httpOnly cookie scoped to `/api/lms/google`, sealed with the teacher's id and refused for anyone else; sign-out deletes it; the OAuth state checked with a nonce, a 15-minute expiry and the teacher who started it; cross-site POSTs refused; answer keys never sent to Classroom; drafts in browser storage kept per teacher.

Still open, each scheduled in the [development steps](../docs/04_development/01_development_steps.md): there is no daily AI allowance; approval is enforced only in the browser; the Classroom Doc is built from content the browser sends rather than a saved version; drafts live in the browser until step 4.
