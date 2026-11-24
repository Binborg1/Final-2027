# 08 · First Slice: What Was Built

**Date:** 18 November 2026 · **Scope:** the teacher half of the vertical slice in `07_migration_roadmap.md`: verified outcome → generated lesson → alignment evidence → teacher revision → approval → publication. Student analytics, divisions, 3D and the Supabase migration were deliberately left out.

## How it maps to the plan

| Plan (docs 02–07) | Built now | Deviation and why |
|---|---|---|
| Curriculum catalog in Postgres with ingestion and two-person verification (C04) | Typed catalog in code, `app/src/lib/curriculum/catalog.ts`, with source URL, retrieval date, status and SHA-256 fingerprint per outcome | No database yet (out of scope this iteration). The four Force and Motion outcomes were copied from the official page on 17 Nov 2026; the second-person check and the indicators are **pending** and shown as such |
| Lesson model v2 with versions and blocks (C05) | Blocks carried on the existing class lecture (`DraftConcept.block`), reusing the review and published-snapshot rules in `app/src/lib/classes/model.ts` | No separate version table: the published snapshot is the version students see, as before |
| Outcome-constrained drafting + alignment report (C06) | `/api/teach` tasks `curriculum-lesson` and `curriculum-block`; validator rejects unsupplied outcome or indicator ids; structural, factual and judgment checks in `app/src/lib/curriculum/checks.ts` | Factual checks cover what can be computed for this outcome (speed, distance, time, slopes, fastest/slowest); everything else is listed as teacher judgment |
| Teacher workspace (C07) | Selector `app/src/app/teach/[code]/curriculum/page.tsx`; review `app/src/components/curriculum/CurriculumReview.tsx`, `CurriculumBlockCard.tsx`, `OutcomeCard.tsx` | Lessons live inside a class (created from the class page), not in a separate lesson library |
| Interactive activity from existing visualizations | Graph and prediction blocks build `function-graph` configs, validated by the existing registry | None |

## Rules the code enforces

1. Only catalog outcomes can be selected or generated for; the server re-checks the outcome and its wording fingerprint.
2. AI output citing any outcome or indicator id the application did not supply is rejected outright.
3. A block can be approved only when its structural and factual checks pass and every judgment item is confirmed for its current content.
4. Any material edit changes the block's fingerprint: earlier confirmations are cleared, checks re-run, and an approval no longer applies (also enforced on the server at every save).
5. A lesson can be published only with an approved block of each of the five kinds, nothing pending, and every approval still valid; the server refuses any snapshot that is not exactly the approved content.
6. Students receive only published snapshots; drafts, checks and review data never leave the teacher's view.

## Run the demonstration

1. `cd app && npm install && npm run dev`, then open http://localhost:3000/teach.
2. **New class** → name, term, the name students see → **Create class**.
3. **Curriculum lesson** → Saskatchewan → Science 10 → Force and Motion in Our World → **SCI10-FM2** → read the outcome card → **Generate lesson**.
4. For each block: read and edit; try marking a wrong answer on the prediction block to see the factual check fail; tick the judgment items; **Approve**.
5. **Publish to students**, then open the class code in another browser (or a private window) from the home page's **Your classes** box.

Without an AI key in `app/.env.local` the lesson starts from Funza's starter template; with a key (Groq, Gemini, OpenRouter or Anthropic) the AI writes it under the same rules.

## Known limitations

- Indicators for SCI10-FM2 are not verified, so alignment is to the outcome statement only.
- The catalog wording was retrieved once; the two-person verification and Ministry reuse terms are still open.
- Only SCI10-FM2 has a lesson template; FM1, FM3 and FM4 are listed but cannot be generated yet.
- The AI path is covered by tests with synthetic model replies, not by a live provider (no key was configured during development).
- Lessons are still stored in the class's Vercel Blob object with edit-key access; accounts and the database come next (C02, C03).
- Student responses and teacher insights (C08–C10) are not built.
