# Funza

Adaptive tutoring prototype for the ENSE 400/477 capstone. Students add a course, attach their PDFs, and work through concepts one at a time: read a short explanation, answer a question, get a hint when wrong, and move on once they show understanding.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Courses, lessons and progress live in the browser's localStorage; there is no server, database or account.

`npm test`, `npm run lint` and `npm run build` are the checks. The tests run on Node's own test runner (Node 22.6 or newer) and cover the pure logic: the visualization registry, the demo player, and the tutor script.

## Where lessons come from

- **Your PDFs.** When a PDF is attached, its text is read in the browser with pdf.js and turned into topics and concepts by rules in `src/lib/lessons/generate.ts`: headings become concepts, the text under them is the explanation, and questions are fill-in-the-blank or short-answer items built from the section's own key terms and sentences. No AI and no network. Questions are rough by design.
- **The sample courses.** Five built-in courses (Computer Networks, Mathematics, Physics, Computer Science, Biology) carry hardcoded lessons so the flow and the visual demonstrations can be tried before any PDF is added. Each can be removed like any other course and added back from the home page.
- **Later.** An AI-backed provider can replace the rule-based generator behind the same `LessonProvider` interface, using the same extracted text.

Scanned PDFs (no selectable text) produce no lessons; the file is marked as such.

## Notes versus question sheets

Each PDF is classified on import. Notes become topics and lessons as above. A sheet of questions (assignment, tutorial, past exam) is detected by its numbering, imperative verbs, question marks and mark allocations, and becomes a **question set** instead. The student can flip the classification from the course page while the file's text is still in memory.

Opening a question set asks one thing first: **guidance or answers?**

- **Guide me**: restate the question, see the matching passages from the course's own notes, follow a plan chosen by question type (calculation, proof, comparison, explanation...), write an attempt and get feedback or a hint. The answer is shown only on request.
- **Answers**: pick a question ("question 3") and have it solved step by step, with the reasoning and a final answer. Answers printed in the PDF itself are shown as well.

Feedback, hints and solving use the AI tutor when a provider is configured; without one, feedback and hints fall back to rules and solving is unavailable.

## Talking tutor in lessons

The brain mascot sits beside each lesson and narrates it: it introduces the concept, reads the question and its options, offers a hint when an answer is wrong, re-explains after repeated misses, and celebrates a correct answer. The script comes from the lesson's own content and the existing answer checking (`src/lib/tutor/tutorLine.ts`); nothing is graded by AI.

Voice uses the browser's Web Speech API and is off until the student turns it on (the setting persists). Everything spoken is shown in the speech bubble, so the lesson works with the voice off or in a browser without speech synthesis. Speech stops on navigation, when the tab is hidden, and before each new line. Animations respect the reduce-motion setting.

| Piece | Purpose |
|---|---|
| `src/components/mascot/FunzaMascot.tsx` | Mascot states: idle, talking, thinking, hinting, celebrating |
| `src/components/mascot/MascotSpeechBubble.tsx` | The bubble with voice on/off, replay and stop |
| `src/lib/speech/useSpeech.ts` | Browser text-to-speech: voice choice, chunking, interruption, cleanup |
| `src/lib/tutor/useTutorGuide.ts` | Speaks each new tutor line once |

### Tutor Mode

"Start Tutor Mode" under the mascot runs the lesson as a guided session: the tutor introduces the topic, explains the concept, asks the question aloud, then waits. Submitting an answer uses the normal checker; a wrong answer gets "not quite", a hint, and the inputs unlock for another try; a right answer gets the explanation and a prompt to press Continue, which introduces the next concept automatically; the end of the topic gets a spoken recap. Steps advance only when the previous speech finishes (`idle -> explaining -> asking -> waiting -> evaluating -> feedback -> next`, with a hint/retry branch). Pause holds both audio and progression, Resume continues, Exit cancels speech and leaves lesson progress untouched. Logic lives in `src/lib/tutor/tutorLine.ts` (the script) and `src/lib/tutor/useTutorSession.ts` (the session).

## Visual demonstrations

Some concepts are taught with a small interactive animation that the student explores while the mascot explains. One engine serves every subject: a lesson (or the AI) asks for a visualization **by name with structured data**, and a hand-written scene renders it. Everything is SVG and Motion for React; no charting or 3D libraries.

### Supported visualization types

Five **generic building blocks** take their content (steps, captions, the prediction) from the lesson or the AI:

| Type | Shows | Content it takes |
|---|---|---|
| `function-graph` | Curves y = f(x) and data points on axes, a marker that moves along a curve, dashed guides to the axes | Curves as formulas in x and the sliders, data points, per-stage marker and visible curves |
| `node-diagram` | Labelled nodes (boxes or circles) joined by arrows; parts light up and items move between nodes | Nodes, edges, layout (row, ring, tree, free), per-stage highlights and token positions |
| `process-sequence` | A chain of named steps; the current one lights up, with a short fact list for that step | Stage titles, captions and facts |
| `quantity-model` | Named quantities as labelled bars that grow, shrink and light up | Quantities as fixed values or formulas over the sliders, per-stage values and highlights |
| `geometry-scene` | Shapes on a grid with measurements, moved, turned and scaled | Polygons, circles, segments, points; per-stage transforms and measurement lines |

Every generic config also carries up to 6 **parameters** (sliders that double as variables for formulas and for `{templates}` in captions), 1 to 24 **stages** (each with a caption and optional slider overrides for that step), and up to 3 **prediction checkpoints**. Numbers may be written as formulas (`"-b/(2*a)"`) in a small calculator language (`src/lib/visualizations/expr.ts`): arithmetic, a fixed list of functions, and only the declared parameter names. The text is parsed into a tree and evaluated by hand; nothing is ever passed to `eval`.

Three **specialized demonstrations** compute their own content and stay as they were: `packet-transmission`, `pcm-sampling` and `protocol-layers` (see the networking sample course).

Every demo has Play, Pause, Step forward, Reset, a caption per step, slider or select controls, a "Read every step as text" list for screen readers, and a **prediction checkpoint**: the demo stops before a key step and asks what happens next. The step is not shown until the student has picked an answer; the response then explains it and the demo carries on. With the voice on, the demo reads its own captions. Animations are instant when the OS asks for reduced motion, and every control is a native button, slider or select, so it works from the keyboard.

### Cross-subject examples

Five built-in sample courses show the same engine teaching different subjects (new browsers get all five; the home page offers any that were removed):

| Course | Concept | Type |
|---|---|---|
| Mathematics | The shape of a parabola | `function-graph` with a, b, c sliders; prediction: what happens when a turns negative |
| Mathematics | Transformations: sliding, turning and scaling | `geometry-scene`; prediction: what scaling by k does to length and area |
| Physics | Distance = speed × time | `quantity-model` with speed and time sliders; prediction: distance after 4 s |
| Physics | Reading a distance-time graph | `function-graph`, two riders; prediction: the slope of the faster rider |
| Computer Science | Bubble sort, pass by pass | `quantity-model`, one stage per comparison (generated by running the algorithm); prediction: where the largest value ends up |
| Biology | Photosynthesis: inputs and outputs | `node-diagram` with tokens for light, CO2, H2O, glucose, O2; prediction: what comes out |
| Biology | The cell cycle | `process-sequence`; prediction: what follows metaphase |
| Computer Networks | Packets, encapsulation, PCM (five concepts) | the three specialized types |

### How the tutor uses them

In Tutor Mode the script becomes: explain the concept, introduce the demo (its title and what to watch for), run it with spoken captions, stop at the prediction and ask it aloud, respond to the answer, finish the demo, then ask the lesson's question (`tutorScript` in `src/lib/tutor/tutorLine.ts`). The manual voice follows the same moments. The mascot's words are the demo's own captions, so narration and picture cannot drift apart.

### AI-driven selection

With an AI key configured, each AI-taught concept's lesson request also asks the model whether a visualization would help, which type fits, which parameters, what the student should observe, and where to pause for a prediction. The reply is structured data in the shapes above (`src/lib/ai/teach-prompts.ts` lists the catalogue from the registry). It is validated on the server before it reaches the browser: unknown types, unknown fields, bad formulas, out-of-range numbers or a prediction that points nowhere make the request fall back to `null`, and the concept is taught with the explanation alone. The model is told to answer `null` for most concepts.

### Limitations

- Only the eight types above exist. Concepts that need anything else (3D, chemistry structures, free-hand sketches, simulations with their own physics, video) get an ordinary explanation.
- Content inside a generic demo is authored, not simulated: a graph is only as right as its formula, and a prediction's correct answer is fixed by whoever wrote it. A stage can pin slider values so a prediction stays true whatever the student has set.
- Formulas know arithmetic and a fixed list of functions over the declared parameters, no vectors, matrices, sums or units.
- Quantity bars show values at or above zero; diagrams hold at most 12 nodes; a demo holds at most 24 stages.

### Architecture

`src/lib/visualizations/registry.ts` is a closed registry of named types; `validateVisualization` turns any request (`{ type, params }`) into a validated config or `null`, and `checkVisualization` says why. Each definition gives `normalize` (strict about shape, lenient about values), `controls`, `applyControl`, `steps`, `checkpoints` and `describe`; the generic ones share their validators (`src/lib/visualizations/generic/common.ts`). `LearningVisualization` (`src/components/visualizations/`) renders any registered type: the scene, captions, controls, the checkpoint and the parameter controls; `usePlayer` owns playback as a pure reducer (`player.ts`) so the tutor can react to it. Subject content lives in lessons (`src/lib/lessons/demo-subjects.ts`), not in components. To add a type: a definition in `src/lib/visualizations/`, a scene in `src/components/visualizations/scenes/`, and one line in the registry.

## Screen-aware tutor

The mascot can be asked about what is on screen. Under the speech bubble in every lesson there is an **Ask Funza about this screen** box with suggested questions: "What am I looking at?", "Explain the diagram", "Where did I go wrong?", "Give me a hint", "Show me another way". The reply appears in the bubble, is spoken when the voice is on, and in Tutor Mode interrupts the script politely: the step being spoken stops, the answer is given, and the step then settles where it was heading.

**In-app awareness (no screenshots).** The views already hold everything a tutor needs, so a structured description of the workspace is built from React state (`src/lib/workspace/context.ts`): course, topic, concept and its explanation, the question and its options, what the student has typed and last checked, attempts, feedback and hints shown, the demo's title, step, caption, pending prediction and slider settings, and the Tutor Mode step. The answer key (correct option, sample answer, "why correct") is left out until the lesson itself has shown it. The five suggested questions are answered locally from that description, with no AI and no network (`src/lib/tutor/askFunza.ts`), so they work offline; hints come out in the lesson's own order and never give the answer away. Any other question goes to the AI tutor (`/api/tutor`, text only) with the same description and a prompt that says what it sees, asks a guiding question, and withholds the answer. Without an AI provider, free-form questions get an honest "I can't take free questions" plus the overview.

**Optional screen sharing.** "Share a screen (optional)" under the ask box uses the browser's Screen Capture API. It is only ever started by the student, who picks a tab, window or screen in the browser's own dialog; a live thumbnail and a "Sharing …" badge stay visible with a Stop sharing button, and leaving the page or the browser's own stop control ends it. Nothing is recorded or stored. "Analyze current screen" takes one still frame (JPEG, at most 1280 pixels wide), shows it in a review dialog with a warning about names, messages, passwords and restricted course material, and sends it only after the student types their question, ticks that they are allowed to share it, and presses Send. The server (`/api/tutor`, task `vision`) forwards the image to the configured provider for that one request and never writes it anywhere. If the configured model cannot read images (for example Groq's default Llama 3.3), the button says so and nothing is sent; `FUNZA_AI_VISION=true|false` overrides the built-in guess. A **local-only** checkbox (remembered in this browser) keeps screenshots on the device entirely: the analyze button is disabled and no cloud call can happen.

Screenshots and the screen description are treated as untrusted data: the prompts tell the model to ignore any instructions that appear inside them, and replies are plain text that is only displayed and spoken.

**Limits.** The ask box lives in the two lesson views (fixed lessons and AI lessons); the question-sheet workspace does not have the talking mascot yet. Screen sharing needs a desktop browser with `getDisplayMedia`. The tutor describes what it is given; it does not read the page itself, so anything outside the lesson state (for example text in another tab) only reaches it through an explicit screenshot.

## Adaptive AI lessons

With an AI key configured, the course page offers "Plan AI lessons" for each notes PDF. Funza then:

1. **Plans** the topic from the PDF: a learning topic, 3 to 6 objectives, and 4 to 8 concepts in teaching order, each linked to the sections it draws on.
2. **Teaches** each concept with a short lesson grounded in those sections. Anything the model adds from general knowledge is kept in a separate field and shown under a "Beyond the PDF / Not from your notes" label, as is any example that the PDF does not contain.
3. **Asks** an original question that needs reasoning (often a small calculation for technical material).
4. **Evaluates** the student's reasoning, not keyword matches: a verdict of correct, partial or incorrect, the likely misconception, a progressively more specific hint, and after a second miss a reteach in different words with a new example.
5. **Verifies** with a new, different question before the concept counts as understood; a correct verification answer records it as completed, and after four misses the student can see the answer and the concept is marked for practice.

The loop lives in `src/lib/teaching/useTeachingSession.ts` (teaching state), `src/lib/retrieval/retrieve.ts` (which sections to teach from), `src/lib/ai/teach-prompts.ts` and `src/app/api/teach/route.ts` (lesson generation and evaluation, server-side), and `src/lib/ai/teach-schema.ts` (every model reply is parsed and validated before it is shown). The UI is `src/components/teach/TeachView.tsx`.

**Privacy.** Rule-based lessons never leave the device. Planning AI lessons sends the extracted text of that one PDF to the configured provider, after a confirmation dialog; teaching a concept sends its relevant sections, the question and the student's answer. The server does not log them. Extracted section text is also kept in this browser's localStorage so lessons can be taught later without re-reading the PDF.

## AI tutor setup

Copy `.env.example` to `.env.local`, add one key, restart. Keys stay on the server; the browser calls `/api/ai`, which holds the key and sends only the question, the student's attempt and the matching note excerpts. Providers: Anthropic (official SDK), Groq, OpenRouter and Gemini (REST). Groq, OpenRouter and Gemini have free tiers.

## Where things are

| Path | Purpose |
|---|---|
| `src/app/` | Routes: home (`/`), course workspace (`/courses/[courseId]`), lesson (`/courses/[courseId]/learn/[topicId]`), progress (`/progress`) |
| `src/components/lesson/LessonView.tsx` | The lesson flow: explain, ask, evaluate, hint or confirm, continue |
| `src/lib/visualizations/` | Visualization registry, typed parameters, step and checkpoint definitions, the playback reducer and hook |
| `src/components/visualizations/` | `LearningVisualization` and the SVG scenes for packets, PCM sampling and protocol layers |
| `tests/` | Node test-runner tests for the registry, the player and the tutor script |
| `src/lib/pdf/extract.ts` | pdf.js text extraction, one entry per line with its font size |
| `src/lib/lessons/generate.ts` | Rule-based lesson generation from extracted text |
| `src/lib/lessons/import.ts` | Reads attached PDFs and saves the generated lessons under the course |
| `src/lib/lessons/provider.ts` | `LessonProvider` interface; picks sample or PDF lessons per course |
| `src/lib/lessons/demo-tcpip.ts`, `src/lib/lessons/demo-subjects.ts` | The sample courses' hardcoded lessons: networking, and mathematics / physics / computer science / biology |
| `src/lib/engine/evaluate.ts` | Answer checking: option match for multiple choice, keyword groups for short answers |
| `src/lib/storage.ts` | localStorage stores for courses, lessons, question sets and progress, exposed as React hooks |
| `src/lib/questions/` | Classifier (notes or questions), question extraction, notes relevance search, guidance scaffolds |
| `src/components/questions/QuestionWorkspace.tsx` | The guidance / answers workspace for a question set |
| `src/lib/ai/` and `src/app/api/ai/route.ts` | Server-side AI provider adapters, prompts, and the route the browser calls |
| `src/lib/workspace/context.ts`, `src/lib/tutor/askFunza.ts`, `src/lib/tutor/useAskFunza.ts` | The structured view of the screen, the local answers to the common questions, and the ask hook |
| `src/lib/screen/useScreenShare.ts`, `src/components/mascot/AskFunza.tsx` | Student-started screen sharing with capture and review; the ask box UI |
| `src/app/api/tutor/route.ts`, `src/lib/ai/tutor-prompts.ts`, `src/lib/ai/vision.ts` | The screen-aware tutor endpoint (text and one-screenshot tasks), its prompts, and image support checks |
| `src/app/api/teach/route.ts`, `src/lib/teaching/`, `src/lib/retrieval/` | Adaptive teaching: planning, lessons, evaluation and verification questions; teaching state; document retrieval |
| `public/pdf.worker.min.mjs` | pdf.js worker, copied from `node_modules/pdfjs-dist/build/` |
