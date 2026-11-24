# 03 · Design System

**Purpose:** the visual language and component set for the teacher workspace: brand, colour, type, spacing, elevation, motion, status language, components and accessibility rules.
**Status:** Stage A proposal, 18 November 2026. Implemented as scoped CSS variables in the prototype (`app/src/app/prototype/prototype.css`); in Stage B the tokens move into the `@theme` block of `app/src/app/globals.css`.

---

## 1. Audit of the current interface

What the app looks like today (uncommitted restyle included):

| Area | Today | Assessment |
|---|---|---|
| Frame | Navy sidebar, warm off-white workspace (`--color-cream #f7f5f0`) | **Keep.** Already the right foundation |
| Primary colour | Violet `#5b3fd9`, stored under the token name `coral` | **Change.** Off-brand (the logo is navy, teal, gold); the name is misleading |
| Hero bands | Navy-to-violet gradient with blurred glows and the orbit art (`HeroBand.tsx`) | **Retire for the workspace.** Decorative weight on every screen; the brief asks for beauty without gradients |
| Type | Plus Jakarta Sans (display, italic 800 for the wordmark) and Inter (UI), loaded with `next/font` | **Keep.** No new fonts needed |
| Components | `Button` (5 variants), `EmptyState`, `CourseCard`, `ClassCard`, class UI helpers, alignment panel, block editors, icons | **Reuse the logic, restyle the surface.** Missing: dialog, toast, tabs, segmented control, switch, stepper, menu, command palette, skeleton |
| Confirmations | `window.confirm` in the lesson builder | **Replace** with an accessible dialog |
| Motion | `framer-motion` springs on buttons and cards; page fade on every route | **Reduce.** Lift-on-hover everywhere competes with content; keep motion for state changes |
| Status | Chips in lavender, mint, sand; check dots | **Formalise** into the five check states below, each with icon and word |
| Brand | `public/brand/funza-logo.png` (raster) and `FunzaLogo.tsx` (traced SVG with a live-text wordmark) | **Temporary.** See section 2 |

---

## 2. Brand

**Direction:** bold, slightly italic Funza wordmark in midnight navy; a teal orbital swoosh; a small golden discovery spark; light and dark variants.

**What exists:** a raster logo (`app/public/brand/funza-logo.png`, light background only) and `FunzaLogo.tsx`, which traces the orbit and spark as paths but sets the wordmark as live text in Plus Jakarta Sans. It is used in light (`tone="light"`) and dark versions. The favicon (`app/src/app/icon.svg`) is a navy tile with a white "F", the swoosh and the spark.

**What is missing before anything public:**

1. An approved vector master (SVG) with the wordmark **outlined**, so it does not depend on a font loading.
2. Light-background and dark-background variants as files, plus a one-colour version for print and fax-quality copies.
3. Clear-space and minimum-size rules (proposed: clear space = the height of the "F"; minimum width 72 px on screen, 20 mm in print).
4. The exact brand colours confirmed. This package uses the values traced from the PNG: navy `#141a3d`, orbit teal `#2cc4a9`, spark gold `#f5b21f`.

Until then the prototype uses `FunzaLogo.tsx` unchanged. Brand moments are limited to the rail logo and one faint orbit on Home.

---

## 3. Colour

### 3.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f6f4ef` | Workspace background: warm off-white |
| `--bg-sunk` | `#eeebe4` | Wells, segmented-control tracks, the editor's backdrop |
| `--surface` | `#ffffff` | Cards, panels, paper |
| `--surface-2` | `#fbfaf7` | Table headers, hover rows, quiet panels |
| `--line` | `#e6e1d6` | Card and divider lines (decorative) |
| `--line-strong` | `#d4cdbf` | Dashed outlines, emphasis lines (decorative) |
| `--line-input` | `#938c7d` | Borders of inputs and steppers (3.3:1 on white, so the control is perceivable) |
| `--ink` | `#141a3d` | Body text; the wordmark navy |
| `--ink-2` | `#3b4263` | Secondary text |
| `--muted` | `#5d627a` | Captions, meta, placeholders' darker sibling |
| `--navy-950 … 300` | `#0b1124`, `#111936`, `#1a2449`, `#26325e`, `#a9b3d3` | Rail, dark surfaces, toasts |
| `--teal-700` | `#0f766e` | **Primary action**, links, focus ring, selection |
| `--teal-800`, `--teal-900` | `#115e57`, `#0f4743` | Hover, text on teal tints |
| `--teal-50 … 200` | `#ebf7f4`, `#d4efe8`, `#a9dfd2` | Selected backgrounds, outcome chips |
| `--teal-400` | `#2cc4a9` | The logo teal: **only on navy** (Create button, active rail marker) |
| `--gold-500` | `#b07a00` | The spark as a status mark on light surfaces |
| `--gold-400` | `#f5b21f` | The logo spark: on navy or as a fill |
| `--gold-50`, `--gold-100`, `--gold-700` | `#fff7e3`, `#fdecc2`, `#8a5300` | "Needs you" chips and notices |
| `--ok`, `--ok-bg` | `#1b6e44`, `#e7f4ec` | Passed, approved, delivered |
| `--bad`, `--bad-bg` | `#b42318`, `#fdecea` | Failed, errors, destructive |
| `--info`, `--info-bg` | `#2850a8`, `#e6eefb` | Changed after review, simulated, information |
| `--none`, `--none-bg` | `#5d627a`, `#eeebe4` | Not verified, planned, not in Funza |

**Rules.** One teal primary action per screen. Gold appears only where something is AI-written and unreviewed, or waits on the teacher. Status colours always come with an icon and a word. No gradients on surfaces; the only gradient is the rail's near-flat navy.

### 3.2 Measured contrast

Computed with the WCAG 2.2 relative-luminance formula.

| Pair | Ratio | Requirement |
|---|---|---|
| White on `--teal-700` (primary button) | 5.47 | 4.5 text ✓ |
| `--teal-700` text on `--bg` | 4.98 | 4.5 ✓ |
| `--ink` on `--bg` | 15.35 | ✓ |
| `--ink-2` on white | 9.79 | ✓ |
| `--muted` on `--bg` / white / `--bg-sunk` | 5.47 / 6.01 / 5.05 | ✓ |
| `--ok` on `--ok-bg` | 5.52 | ✓ |
| `--bad` on `--bad-bg` | 5.75 | ✓ |
| `--info` on `--info-bg` | 6.42 | ✓ |
| `--gold-700` on `--gold-50` | 5.93 | ✓ |
| `--navy-300` on `--navy-950` (rail text) | 9.00 | ✓ |
| `--navy-950` on `--teal-400` (Create) | 8.55 | ✓ |
| `--gold-500` spark on white / `--bg` | 3.73 / 3.39 | 3.0 non-text ✓ |
| `--line-input` on white | 3.34 | 3.0 non-text ✓ |
| Placeholder `#6c7086` on white | 4.88 | ✓ |

Two values were corrected during this check: the logo gold (1.86:1 on white) is no longer used as a status mark on light surfaces, and input borders moved from `--line` (about 1.6:1) to `--line-input`.

### 3.3 Dark mode

Not in the MVP. The rail and toasts already use the dark palette. A dark theme maps surfaces to the navy scale, keeps `--teal-400` as the primary on dark, and uses `--gold-400` for the spark. It needs its own contrast pass.

---

## 4. Typography

| Role | Face | Size / line height | Weight |
|---|---|---|---|
| Page title | Plus Jakarta Sans | 28–32 / 1.2 | 700, tracking −0.015 em |
| Section title | Plus Jakarta Sans | 16–20 / 1.3 | 700 |
| Body (interface) | Inter | 14 / 1.5 | 400–600 |
| Small and meta | Inter | 12.5–13 / 1.45 | 400–600 |
| Eyebrow | Inter | 11, uppercase, tracking 0.08 em | 600 |
| Document text (the page) | Inter | 15 / 1.65 | 400 |
| Document title | Plus Jakarta Sans | 26 / 1.2 | 700 |
| Official wording | Inter | 15 / 1.55 in quotation marks, 3 px navy rule on the left, never editable | 400 |

Both faces already load through `next/font/google` in `app/src/app/layout.tsx`. Numbers in tables and marks use tabular figures.

---

## 5. Space, shape, elevation, motion

| Token | Values |
|---|---|
| Spacing | 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Radii | `--r-sm` 8 (chips, small buttons), `--r-md` 10 (buttons, inputs), `--r-lg` 14 (cards, panels), `--r-xl` 20 (dialogs); paper 4 |
| Elevation | `--sh-1` hairline (controls), `--sh-2` card, `--sh-3` popovers, dialogs and toasts, `--sh-paper` the document |
| Motion | 120–200 ms with `cubic-bezier(.2,.8,.2,1)`. Screens rise 6 px on entry; dialogs pop 4 px; skeletons shimmer. Nothing loops except progress. Everything stops under `prefers-reduced-motion` |

---

## 6. Icons

Line icons on a 24 px grid with a 1.8 stroke, matching `app/src/components/icons.tsx`; the prototype adds about 50 in `app/src/app/prototype/_components/icons.tsx`. Resource types each get an icon and one quiet tint (notes blue, quiz teal, exam indigo, lesson plan gold-tint, worksheet clay, presentation grey). Status marks are filled shapes: the four-point spark, ✓, ✕, a dashed circle, a person-check. No icon library is added.

---

## 7. Status language

The same words and marks on every screen.

| Check state | Mark | Colour | Meaning |
|---|---|---|---|
| **Passed** | ✓ | ok | Funza computed it and it holds, for the content as it is now |
| **Failed** | ✕ | bad | Funza computed it and it does not hold. Blocks approval. Usually offers a fix |
| **Not verified** | dashed circle | none | Funza cannot check this kind of thing (a conceptual answer, prose). Says so plainly |
| **Needs you** | person-check | gold | Only the teacher can decide; blocks approval until confirmed |
| **Changed** | ↻ | info | You reviewed it, then it changed; review it again |

| Curriculum mark | Meaning |
|---|---|
| **Verified** (teal shield with check) | Copied from the official page and checked by a second person. No outcome has this yet |
| **Official source** (half shield) | Copied word for word from the official page; second check pending. Usable |
| **Awaiting team review** (dashed) | Read from the official page, not checked. Shown, never usable for alignment |
| **Not in Funza yet** | Listed officially, not copied. Nothing to align to |

Resource states: **Draft vN** (gold chip) and **Approved vN** (green chip). Delivery entries: done, failed, and (prototype only) simulated.

The **spark** marks a part as "AI drafted, not yet reviewed by you". It disappears when the teacher marks that part reviewed and returns as ↻ after an edit.

---

## 8. Component inventory

| Component | Purpose | Reuses (EXISTING) | Prototype | Stage B target |
|---|---|---|---|---|
| App shell, rail, top bar, breadcrumbs | Navigation | `Sidebar.tsx`, `FunzaLogo.tsx` | `_components/shell.tsx` | `src/components/shell/*` (MODIFY `Sidebar.tsx`) |
| Command palette | Search and actions | — | `shell.tsx` | `src/components/shell/CommandPalette.tsx` (NEW) |
| Button, link button, icon button | Actions | `Button.tsx` (variants), `motion.tsx` | `_components/ui.tsx` | MODIFY `Button.tsx`: teal primary, sizes, loading |
| Pill, check badge, verification badge, AI spark | Status | `AlignmentPanel.tsx` `ReviewChip`, `StatusDot` | `ui.tsx` | `src/components/status/*` (NEW) |
| Outcome chip, official wording | Curriculum identity | `OutcomeCard.tsx` | `ui.tsx` | MODIFY `OutcomeCard.tsx` |
| Curriculum selector (courses, outcomes, detail) | Browse and pick outcomes | `CurriculumExplorer.tsx`, `catalog.ts` | `_components/curriculum.tsx` | MODIFY `CurriculumExplorer.tsx` |
| Resource type card | Choose what to make | — | `_components/create.tsx` | NEW |
| Brief form and assessment configuration (question mix, difficulty, ordering, extras) | Configure without prompting | — | `create.tsx` | NEW |
| Blueprint | Deterministic preview | — | `create.tsx`, `model.ts` | NEW `src/lib/resources/blueprint.ts` |
| Generation progress | Loading, cancel, failure, retry | `useAiStatus` | `create.tsx` | NEW |
| Document canvas with lenses | Edit the page | `BlockWorkspace.tsx`, `ConceptReviewCard.tsx` `TextField` | `_components/review.tsx` | NEW, reusing the review logic |
| Question view and question editors (7 types) | Edit questions | `BlockEditors.tsx` (`ItemsEditor`) | `review.tsx` | MODIFY and extend |
| Outline panel | Navigate and reorder | `BlockNav.tsx` | `review.tsx` | MODIFY |
| Checks panel and alignment panel | Evidence | `AlignmentPanel.tsx`, `checks.ts` | `review.tsx` | MODIFY |
| Regenerate comparison | One part, old beside new | `regenerateBlock` in `curriculum/generate.ts` | `review.tsx` | MODIFY |
| Approve dialog | Lock a version | `canPublish` in `classes/model.ts` | `review.tsx` | NEW UI over existing rules |
| Export rows, print view | Downloads | Report page print CSS | `_components/deliver.tsx` | NEW |
| Destination cards, connection states, publish progress | LMS | — | `deliver.tsx` | NEW |
| Library list and filters | Find materials | `CourseCard.tsx` patterns | `_components/more.tsx` | NEW |
| Dialog, menu, tabs, segmented control, switch, stepper, field | Primitives | — | `ui.tsx`, `parts.tsx` | NEW `src/components/ui/*` |
| Skeleton, empty state, notice, toast | Feedback | `EmptyState.tsx`, `Spinner.tsx` | `ui.tsx`, `shell.tsx` | MODIFY `EmptyState.tsx`; NEW others |
| Interactive graph | Visualizations | `ActivityStage.tsx`, registry | used as is | EXISTING |

---

## 9. Accessibility (WCAG 2.2 AA)

| Criterion | How the design meets it | Verified in the prototype |
|---|---|---|
| 1.4.3, 1.4.11 contrast | Section 3.2; status never colour-only | Measured |
| 1.4.10 reflow | No horizontal scrolling at 390 px; panels become sheets | Checked at 390 × 844 |
| 1.4.12 text spacing | No fixed-height text containers | By construction |
| 2.1.1 keyboard | Every control is a native button, link or input; segmented controls and tabs use arrow keys; dialogs trap focus and close on Esc; menus support arrows | Driven by keyboard in the headless run |
| 2.4.1 bypass blocks | "Skip to content" link | Present |
| 2.4.7, 2.4.13 focus visible and appearance | 2 px teal outline with 2 px offset (`#7fe0cf` on navy) | Present |
| 2.4.11 focus not obscured | `scroll-padding-top: 72px` for the sticky top bar | Present |
| 2.5.7 dragging movements | Reordering uses Move up and Move down buttons; drag, when added, is a shortcut, not the only way | Buttons present |
| 2.5.8 target size | Interactive targets are at least 24 × 24 px (icon buttons 32 px) | By construction |
| 3.2.6 consistent help | Shortcuts and search sit in the same place on every screen | Present |
| 3.3.1, 3.3.3 errors | Errors say what failed, what is kept and what to do, beside the field or part | Present |
| 3.3.7 redundant entry | Outcome selections carry from Curriculum to Create to the document | Present |
| 3.3.8 accessible authentication | Sign-in via Google's own screen; no puzzles | Planned |
| 4.1.3 status messages | Toasts and generation progress use `aria-live` | Present |
| Reduced motion | All animation stops; skeletons stop shimmering | CSS present |

Keyboard map: **Ctrl K** or **/** search · **C** create · **?** shortcuts · in the editor **J/K** move, **R** mark reviewed, **N** next that needs you, **[** and **]** hide or show panels, **Esc** deselect.

---

## 10. Content style

- Plain words, sentence case, no exclamation marks, no hype ("magic", "instantly").
- Name the outcome by its printed code. Quote official wording; never paraphrase it.
- Say "AI" when the AI did something; never imply a teacher or Funza wrote AI text.
- Errors: what happened, what is kept, what to do next. "The AI provider is busy. Nothing was saved. Your settings are kept, so you can try again in a minute."
- Never say "compliant", "aligned" as a verdict, or "verified" for anything a second person has not checked.
