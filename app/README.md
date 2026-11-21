# Funza Teacher Studio: the app

The Next.js app for **Funza Teacher Studio**: Prepare and Live modes for Saskatchewan Grade 10–12 teachers. What it must do is in [requirements and architecture](../docs/03_design/02_requirements_and_architecture/requirements_and_architecture.md), and the build order is in the [development steps](../docs/04_development/01_development_steps.md).

**State on 21 November 2026.** The earlier teacher workspace's screens were removed, because Teacher Studio gets a new design (development step 2). The home page is a placeholder. What stays is the logic and the API: AI drafting with checked replies, the Saskatchewan curriculum, the review checks, the student copy and Google Classroom publishing. The ideas from the removed screens are written up in [concepts from the earlier app](../docs/04_development/04_concepts_from_the_earlier_app.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Checks: `npm test`, `npm run lint`, `npm run build`. Tests use Node's own test runner (Node 22.6 or newer).

## Configuration

Copy `.env.example` to `.env.local` (or set the variables in Vercel).

| Variables | What they turn on | Without them |
|---|---|---|
| `GEMINI_API_KEY` (Groq or OpenRouter can stand in during development) | AI drafting of whole materials and single questions | Drafts start from Funza's starter question bank (Science 10, SCI10-FM2 and FM3) or from empty parts |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FUNZA_SESSION_SECRET` | Publishing to Google Classroom | Classroom reports that it is not set up; printing still works |

**Don't put the Gemini key on a Vercel deployment until teacher sign-in protects `/api/teach`** (development step 3). Until then, anyone who finds the URL could spend it.

Google Classroom setup (once per deployment):

1. In Google Cloud, enable the **Google Classroom API** and the **Google Drive API**.
2. Configure the OAuth consent screen with the scopes Funza requests: `classroom.courses.readonly`, `classroom.topics.readonly`, `classroom.courseworkmaterials`, `classroom.coursework.students` (needed to post assignments), `drive.file`. While the app is in Google's Testing mode, refresh tokens expire after 7 days.
3. Create an OAuth client of type **Web application** with the redirect URI `https://<your-site>/api/lms/google/callback` (and `http://localhost:3000/api/lms/google/callback` for development). The same client is entered in Supabase for teacher sign-in, with Supabase's own callback URL added.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a random `FUNZA_SESSION_SECRET` of at least 32 characters, then redeploy or restart.

## Where things are

| Path | What it holds |
|---|---|
| `src/app/page.tsx`, `layout.tsx`, `globals.css` | A placeholder page and a bare layout (Tailwind 4 through PostCSS), until the new screens |
| `src/app/api/teach/` | AI drafting: checks each outcome against the curriculum, sends the model only those outcomes, and validates the reply before it leaves the server |
| `src/app/api/curriculum/` | The curriculum: course list, one course, search, outcomes |
| `src/app/api/lms/google/` | Google Classroom: connect, callback, status, classes, topics, create the student copy as a Google Doc, post, disconnect |
| `src/lib/ai/` | `server.ts`: the only code that calls the AI (Gemini first, key in a header, time limit, safe error messages). `resource-prompts.ts`: prompts, with uploaded text wrapped and defused as data. `json.ts`: reply parsing |
| `src/lib/resources/` | The material model (notes, slides, quiz, test, exam), the blueprint computed before any AI call, the starter bank, draft assembly, the review checks, validation of untrusted input, the student-copy renderer, and the browser store (`store.ts`, local storage until development step 4) |
| `src/lib/curriculum/` | The catalog and its checks (`catalog.ts`), the imported dataset on the server (`dataset.ts`) and in the browser (`client.ts`) |
| `src/data/curriculum/` | The imported curriculum (`sk.json`) and the import report (`sk-report.md`) |
| `scripts/curriculum/` | The importer, a PostgreSQL schema and an SQL exporter |
| `src/lib/lms/` | Google OAuth session (encrypted cookie), Classroom and Drive calls, the browser client, and `publish.ts` (one Doc posted to several classes) |
| `src/lib/math/expr.ts` | A safe calculator language that recomputes answer keys. Not for marking students' typed answers |
| `src/lib/pdf/extract.ts` | Reads a PDF's text in the browser with pdf.js (the worker in `public/` must match the pinned `pdfjs-dist` version) |
| `src/lib/origin.ts` | Refuses cross-site POSTs to cookie-protected routes |
| `tests/` | Curriculum, resources, Classroom, expression engine, and security tests |

## How drafting and review work

| Step | What happens |
|---|---|
| Brief | The teacher's settings (kind, outcomes, question mix, marks, time, difficulty). A blueprint is computed by code (`src/lib/resources/blueprint.ts`) before any AI call |
| Draft | `/api/teach` re-checks each outcome and its fingerprint, sends the model only those ids and their wording, and validates the reply (`src/lib/resources/ai-reply.ts`). A reply citing any other outcome is rejected whole; malformed questions are dropped and listed |
| Review | Checks run on every change (`src/lib/resources/checks.ts`): complete questions, catalog outcomes only, rubric totals, answers recomputed by the expression engine, coverage. Every AI or bank part stays marked until the teacher reviews it; any edit returns it to review |
| Approve | Needs nothing failed and nothing waiting on the teacher. The approved version is frozen; edits start a new version |
| Publish | The student copy (`src/lib/resources/render.ts`) never contains answers, keys, worked solutions or rubrics. Classroom gets it as a Google Doc in the teacher's Drive, then a material or assignment per class, as a draft by default |

## Curriculum data

`src/data/curriculum/sk.json` holds every Saskatchewan Grade 10–12 curriculum: courses, units, outcomes (code and verbatim wording) and indicators. It is generated, never edited by hand:

```bash
node scripts/curriculum/import-sk.mjs            # about an hour the first time; cached pages make re-runs fast
node scripts/curriculum/import-sk.mjs --refresh  # fetch every page again (when the Ministry changes something)
node scripts/curriculum/import-sk.mjs --only=63  # one curriculum, by its curriculum.gov.sk.ca id
```

The importer reads the course list, each course's outcomes page and each outcome's own page on curriculum.gov.sk.ca (two requests at a time, under one a second), then compares every statement with the Ministry's CSV files on EDonline. It writes `sk.json` and `sk-report.md` (counts, and everything a person should look at, such as an indicator letter printed twice). Raw pages are cached in `.cache/curriculum/` (not committed).

| Status | Meaning | Usable |
|---|---|---|
| `cross-checked` | Copied automatically; the Ministry CSV has the same words | Yes, labelled "Imported · matches CSV" |
| `imported` | Copied automatically; no CSV, or the CSV words it differently (the note says how) | Yes, labelled "Imported" |
| `source-checked` | Copied by a team member (Science 10 FM1–FM4) | Yes |
| `verified` | Compared with the official page by a second person | Yes (none yet) |

No person has checked the imported text, so the review checklist asks the teacher to confirm it before approval. French immersion and Fransaskois curricula are not imported yet, and the Ministry's reuse terms for the wording are still to be confirmed.

## Security: what is in place and what is still open

In place: AI keys only on the server; teacher files treated as data in prompts; AI replies rebuilt field by field; the Google token in an AES-256-GCM encrypted, httpOnly cookie scoped to `/api/lms/google`; the OAuth state checked with a nonce and a 15-minute expiry; cross-site POSTs refused; answer keys never sent to Classroom.

Still open, each scheduled in the [development steps](../docs/04_development/01_development_steps.md): `/api/teach` and the Classroom routes don't yet require a signed-in teacher; the Classroom cookie isn't tied to a teacher, so on a shared computer the next person inherits the connection; there is no daily AI allowance; approval is enforced only in the browser; the Classroom Doc is built from content the browser sends rather than a saved version.
