# Concepts from the earlier app
**Funza Teacher Studio · v0.1 · 21 November 2026**

This is a short list of the features in the earlier teacher workspace that the new UI removes, so the team can bring the useful ones back into Teacher Studio. The code is at commit `984eb7d`, or at `c611d8f^` for the Live pieces, and you can read any file with `git show`. These are candidates, not requirements: if this list and the product definition disagree, the product definition wins.

```
git show 984eb7d:app/src/components/workspace/review.tsx
```

## Prepare builder

- **Brief**: a five-step form for type, outcomes, details, the teacher's own file and a note, with question-mix and difficulty presets. `app/src/components/workspace/create.tsx`, `app/src/lib/resources/kinds.ts`
- **Blueprint preview**: a side panel that shows questions, marks, estimated time, parts and warnings before any AI call. `app/src/lib/resources/blueprint.ts`
- **No-AI paths**: start from the starter question bank, or write the material yourself from the blueprint. `app/src/lib/resources/assemble.ts`
- **Material upload**: reads a PDF or text file in the browser and sends its text as untrusted reference material. `create.tsx` (`Material`), `app/src/lib/ai/resource-prompts.ts`
- **Generation progress**: five visible stages, with a plain-language message and next step for each AI error. `app/src/lib/resources/store.ts` (`stagesFor`, `ERROR_TEXT`)
- **Home**: picks up the latest draft with its review progress, and lists drafts waiting for review. `app/src/components/workspace/home.tsx`
- **Library**: every material grouped by course, with search, type and status filters, and reuse. `app/src/components/workspace/library.tsx`
- **Shell**: navigation rail, command palette (Ctrl K), keyboard shortcuts, toasts and the school-name setting. `app/src/components/workspace/shell.tsx`

## Review and approval

- **Document editor**: the draft shown as paper, with an outline, a checks panel and student, key and alignment views. `app/src/components/workspace/review.tsx`
- **Checks panel**: Must fix, Needs you, Funza can't check and Passed groups, recomputed on every edit. `review.tsx` (`ChecksPanel`), `app/src/lib/resources/checks.ts`
- **Fix actions**: one click to use a recomputed answer, fix a rubric total, or cover a missing outcome. `store.ts` (`applyFix`)
- **Review fingerprints**: a part stays reviewed only until its content changes. `checks.ts` (`itemFp`, `sectionFp`)
- **Next that needs you**: jumps to the next unreviewed or failing part (key N). `review.tsx` (`nextNeedingYou`)
- **Regenerate one question**: shows the new question beside the old one until the teacher picks. `store.ts` (`regenerateItem`), `review.tsx` (`ItemToolbar`)
- **Approval and versions**: approval waits for every blocker to clear, then freezes the approved version; editing starts the next version. `review.tsx` (`ApproveDialog`), `store.ts` (`approve`, `startNewVersion`)
- **Question editor**: per-type fields for options, pairs, rubric, marks, difficulty and outcome. `review.tsx` (`ItemEditor`)
- Bug, don't copy this: new option ids came from `fromCharCode(97 + length)`, so removing an option and then adding one could repeat an id (`review.tsx`, about line 831).

## Publish

- **Google Classroom**: posts to several classes as material or an assignment, as a draft, now or scheduled. Every class shares one Google Doc, each class gets its own status row, and answer keys are never attached. `app/src/components/workspace/deliver.tsx`, `app/src/lib/resources/render.ts`
- **Print**: the student copy or the answer key, on Letter or A4, or a proof marked DRAFT while the material is not approved. `deliver.tsx` (`PrintableDoc`, `NotApproved`)
- **Publishing history**: a log of every post and print, with its version and result. `deliver.tsx` (`History`)
- **"Your school has not allowed Funza yet"**: a ready-made note the teacher copies to send to their Workspace admin. `deliver.tsx` (`PermissionRequired`)
- **Integrations**: connect and disconnect Google Classroom, with a list of what Funza never touches. `app/src/components/workspace/integrations.tsx`

## Curriculum

- **Curriculum browser**: every Saskatchewan Grade 10–12 course, filtered by grade and subject and searchable by code or words. `app/src/components/workspace/curriculum.tsx`
- **Outcome detail**: the official wording, indicators, source link, wording fingerprint and check history. `curriculum.tsx` (`OutcomeDetail`)
- **Verification badges**: Verified, Official source, Imported · matches CSV, Imported and Awaiting team review. `app/src/components/workspace/ui.tsx` (`VerificationBadge`)
- Don't reuse the coloured vertical accent bars: `.fz-official` in front of official wording, and the active-navigation pill in `shell.tsx`.

## Removed material kinds

These kinds are not in Teacher Studio. The product definition would have to change before any of them is built.

- **Lesson plan**: a plan for the teacher only, with timed phases that must add up to the class length and an adaptations section. `app/src/lib/resources/blueprint.ts` (`scaleMinutes`), `app/src/lib/resources/bank.ts` (`LESSON_PLAN`)
- **Worksheet**: a worked example whose stated result Funza recomputes, then practice questions. `app/src/lib/resources/ai-reply.ts`, `app/src/lib/ai/resource-prompts.ts`
- **Homework**: a preset short question mix to finish at home. `app/src/lib/resources/kinds.ts`
- **Interactive graph**: a distance–time graph built from riders' speeds, for Science 10 FM2. `app/src/lib/resources/graph.ts`

## Interactive figures

- **Figure registry**: five figure types (function graph, geometry, node diagram, process sequence, quantity model) that the AI can request only by name. `app/src/lib/visualizations/registry.ts`
- **Validated configs**: rejects a config with the wrong shape, and clamps and trims its values. `app/src/lib/visualizations/generic/`
- **Figure player**: animated SVG scenes with steps, captions and sliders. `app/src/components/visualizations/`
- **Safe expression engine** (kept): evaluates formulas without `eval`, and checks answers by recomputing them. `app/src/lib/math/expr.ts`
- **Possible uses**: figures in notes, on slides and in Live questions.

## AI extras

- **Anthropic provider with refusal fallback**: a declined request was retried on a sibling model within the same call. `app/src/lib/ai/server.ts`
- **Image input**: checks that the model can read images, validates the image and never stores it. It could let Gemini read scanned past exams in Release 2. `app/src/lib/ai/vision.ts`

## Live pieces in history (`c611d8f^`)

- **Join-code generator**: 6-character codes without look-alike letters, with normalizing and a test. `app/src/lib/classes/model.ts`, `app/tests/classes.test.ts`
- **`keyMatches`**: compares a secret key by its hash, timing-safe; the pattern could serve student rejoin tokens. `app/src/lib/classes/server.ts`
- **Keyword-marked short answers**: matched groups of synonyms in a student's answer. Teacher Studio replaces it with AI marking that the teacher can override. `app/src/lib/engine/evaluate.ts`
- **Join form**: one code field with friendly validation. `app/src/components/classes/JoinClassForm.tsx`

## Not coming back

- **Talking brain mascot**: discarded with the student tutor. `app/src/components/BrainMascot.tsx`
- **Voice**: discarded with the student tutor. `app/src/lib/visualizations/usePlayer.ts`
- **Prediction gate**: discarded with the student tutor. `app/src/lib/visualizations/player.ts`
