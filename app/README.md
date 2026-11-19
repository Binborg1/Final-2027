# Funza

A teaching workspace for **Saskatchewan Grade 10–12 teachers**. A teacher picks an official curriculum outcome, says what they need (notes, a quiz, a unit test, an exam, a lesson plan, a worksheet, homework, a presentation outline or an interactive graph), reviews the draft Funza makes, approves it, and publishes it to their **Google Classroom** classes. Teachers are the only users: students receive approved resources through the school's platform, never through Funza.

**Funza creates. Teachers approve. Existing school platforms deliver.**

The design is in `docs/09_teacher_workspace_design/`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Checks: `npm test`, `npm run lint`, `npm run build`. Tests use Node's own test runner (Node 22.6 or newer).

After pulling big changes, restart `npm run dev`: Turbopack can keep serving an old `globals.css` until the server restarts.

## Configuration

Copy `.env.example` to `.env.local` (or set the variables in Vercel).

| Variables | What they turn on | Without them |
|---|---|---|
| One AI provider (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, or `FUNZA_AI_PROVIDER` + `FUNZA_AI_API_KEY`) | AI drafting of whole resources and single questions | Teachers start from Funza's question bank (Science 10, SCI10-FM2 and FM3) or write from the blueprint |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FUNZA_SESSION_SECRET` | Publishing to Google Classroom | The Publish screen says Classroom is not set up; printing still works |
| `BLOB_READ_WRITE_TOKEN`, `SURVEY_ADMIN_KEY` | The usability questionnaire at `/survey` | The survey asks participants to use paper |

Google Classroom setup (once per Funza deployment):

1. In Google Cloud, create a project and enable the **Google Classroom API** and the **Google Drive API**.
2. Configure the OAuth consent screen. Add the scopes Funza requests: `classroom.courses.readonly`, `classroom.topics.readonly`, `classroom.courseworkmaterials`, `classroom.coursework.students`, `drive.file`.
3. Create an OAuth client of type **Web application** with the redirect URI `https://<your-site>/api/lms/google/callback` (and `http://localhost:3000/api/lms/google/callback` for development).
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a random `FUNZA_SESSION_SECRET` of at least 32 characters, then redeploy or restart.

A school's Google Workspace admin may still need to allow the app; teachers then see "Your school has not allowed Funza yet" with a note they can send.

## How it works

| Step | Screen | What happens |
|---|---|---|
| Choose | `/curriculum` | Outcomes are quoted from the catalog (`src/lib/curriculum/catalog.ts`), copied from curriculum.gov.sk.ca with a source, retrieval date and SHA-256 fingerprint, and shown with their verification status. Nothing curricular is AI-written |
| Brief | `/create` | The teacher sets type, outcomes, question mix, marks, time, difficulty and extras. A blueprint is computed by code (`src/lib/resources/blueprint.ts`) before any AI call. A PDF or text file is read in the browser; only its text is sent |
| Draft | `/api/teach` | The server re-checks each outcome and its fingerprint, sends the model only those ids and their wording (`src/lib/ai/resource-prompts.ts`), and validates the reply (`src/lib/resources/ai-reply.ts`). A reply citing any other outcome is rejected whole; malformed questions are dropped and listed |
| Review | `/resources/[id]` | The page is the document. Checks run on every change (`src/lib/resources/checks.ts`): complete questions, catalog outcomes only, rubric and timing totals, answers recomputed by the expression engine, coverage. Every AI or bank part stays marked until the teacher reviews it; any edit returns it to review |
| Approve | same | Needs nothing failed and nothing waiting on the teacher. The approved version is frozen; edits start a new version |
| Publish | `/resources/[id]/deliver` | Creates the student copy as a Google Doc in the teacher's Drive (`drive.file`), then a material or assignment per chosen class, as a draft by default. Answer keys are never attached. A post counts only when Classroom confirms it. Printing (student copy, answer key) is for the teacher's own use |

**Storage.** Resources are saved in the teacher's browser (`localStorage`, key `funza.workspace.v1`, validated on every load) until teacher accounts and a database exist. The Google token lives in an AES-256-GCM-encrypted, httpOnly cookie scoped to `/api/lms/google`; Funza stores nothing about students.

## Where things are

| Path | Purpose |
|---|---|
| `src/app/` | Routes: `/`, `/curriculum`, `/create`, `/library`, `/resources/[id]`, `/resources/[id]/deliver`, `/integrations`, `/survey`; API: `/api/teach`, `/api/lms/google/*`, `/api/survey` |
| `src/components/workspace/` | The screens and the design-system components (`ui.tsx`, `icons.tsx`, `shell.tsx`) |
| `src/lib/resources/` | Resource model, blueprint, starter question bank, checks, validation of untrusted input, the client store, the student-copy renderer |
| `src/lib/curriculum/` | The verified catalog and the official course list |
| `src/lib/lms/` | Google OAuth session, Classroom and Drive calls, browser client |
| `src/lib/ai/server.ts` | One `complete()` over Anthropic, Groq, OpenRouter and Gemini; keys stay on the server |
| `src/lib/visualizations/`, `src/components/visualizations/` | The interactive graph used in notes and the interactive-graph resource |
| `tests/` | Catalog, resources, LMS, visualization and survey tests |

## Not built yet

Teacher accounts and a database (resources are per browser), Microsoft Teams, Canvas and Moodle, Word and PowerPoint export, auto-graded quizzes (Google Forms), curriculum beyond Science 10 · Force and Motion, verified indicators. The Google Classroom integration follows Google's documented API but has not yet been run against a real Google Workspace account.
