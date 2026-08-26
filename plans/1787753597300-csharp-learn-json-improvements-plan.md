# Plan: Improve the C# Learn JSON Content

Status: **Implementation-ready (phase 1)**, with topic scope resolved to a
recommended default (see §9).

## 0. What I reviewed

- Inspected all `data/*-learn.json` files (schema, slide counts, exercise mix)
  and `data/*-quiz-*.json` shapes, cross-checked against `script.js` renderers
  (`renderLearnExercise`, `renderLearnCode`, `simulateCSharp`, `saveQuizResult`,
  completion-badge/progress logic).
- Tried to benchmark against the linked tutorial sites; Exercism returned 403
  (bot/geo-blocked), so findings below are from the local files + standard C#
  curriculum. The recommendations still map to what those resources cover.

## 1. Current state (good)

- **Consistent schema** across 34 learn files: `{section, title, slides[]}`,
  each slide = `title` + `content` + optional `example`/`exampleOutput` +
  optional `exercise` (or `execution`/`flow`).
- **Good exercise mix** per file: `multiplechoice`, `dragdrop`, `fillblank`,
  `code`, each giving immediate feedback — matches a concept→example→exercise flow.
- `code` exercises use `simulateCSharp` (regex `outputPattern` + `requiredStrings` +
  `expectedOutput`), and the last "Next" slide auto-starts the quiz.
- `fillblank` supports `placeholder` + `caseSensitive`; quiz `coderunner` supports a
  `hints` array (used in `csharp-breakcontinue-quiz-B`).

## 2. Findings (where content can improve)

1. **Curriculum gaps vs. the 5 resources.** No learn/quiz pairs for: collections
   (`List<T>`, `Dictionary<K,V>`), LINQ, async/await (Tasks), generics, delegates &
   events, nullable reference types, records, and (to a lesser extent) pattern
   matching. These are core C# in any of those sites.
2. **Weak `code`-exercise validation → false positives.** E.g. the OOP "add a
   `Diameter` returning `2*radius`" exercise uses `outputPattern: "double.*2"` +
   `requiredStrings: ["class"]` — `class P { double r; double Diameter() => double * r; }`
   passes (has `class` and `double`+`2`) though it doesn't compile. Tokens that
   actually prove intent (`Diameter`, `radius`, `2 *`) are missing from
   `requiredStrings`.
3. **Inconsistent depth.** `csharp-control-learn.json` has 3 slides while most
   have 8–9; `csharp-intro-learn.json` has several content-only slides with empty
   `example`/`exampleOutput`.
4. **`hints` not surfaced in learn.** `hints` exists for quiz `coderunner` but the
   learn `code` renderer (`renderLearnCode`) never shows them — no progressive
   scaffolding in Learn (an Exercism-style gap).
5. **No learn-progress persistence.** Only quiz results are saved to
   `localStorage`; Learn has no `started/in-progress/done` tracking or badge parity
   with the quiz completion badges.
6. **Repo hygiene:** an empty `examoles/` dir (typo of `examples`) and `.DS_Store`
   files clutter the tree.

## 3. Decisions (recommended defaults)

| Decision | Recommended choice |
|---|---|
| New topics to add | collections, LINQ, async/await, generics, delegates/events (5 sections) |
| Extended topics (phase 2) | nullable ref types, records, pattern matching |
| Code-exercise validation | tighten `requiredStrings` to prove intent + stronger `outputPattern` |
| Hints in Learn | add `hints` to learn `code` exercises; render in `renderLearnCode` |
| Slide-count target | 6–8 slides/section; expand `csharp-control-learn` to ≥6 |
| Learn progress | persist `learnProgress` {section: {lastSlide, completed}} + badge |

## 4. Affected files

- `data/csharp-{collections,linq,async,generics,delegates-events}-learn.json` (new)
- `data/csharp-{…}-quiz-{A,B,C}.json` (new) + add cards in `index.html`
- existing learn files edited (expand `csharp-control-learn`, tighten validators,
  populate empty `exampleOutput`, add `hints`)
- `script.js`: `renderLearnCode` to show `hints`; add learn-progress persistence +
  badge; `simulateCSharp` stays heuristic (document limitation).
- `SOURCE_OF_TRUTH.md` §3.4: document `hints`, `placeholder`, `caseSensitive`.

## 5. Ordered task list

- [ ] T1. Lint all learn files: every code-example slide must have `exampleOutput`;
      every `code` exercise must list `requiredStrings` that prove intent.
- [ ] T2. Add 5 new learn+json+quiz section pairs (collections, LINQ, async/await,
      generics, delegates/events), following `SOURCE_OF_TRUTH.md` §3.4 / §3.2.
- [ ] T3. Add the 5 new `.section-card`s to `index.html` (level: intermediate/expert).
- [ ] T4. Harden existing `code` validators: tighten `requiredStrings` +
      `outputPattern`; add `hints` arrays to learn `code` exercises.
- [ ] T5. `script.js`: render `hints` in `renderLearnCode`; persist
      `learnProgress`; draw a "started" badge on cards.
- [ ] T6. Populate `exampleOutput` on all code-example slides.
- [ ] T7. Repo hygiene: remove empty `examoles/`, add `.gitignore` (`*.DS_Store`).
- [ ] T8. Validate: walk every new + repaired learn file; confirm the hardened
      `code` exercise now **rejects** the old false-positive code above.

## 6. Risks

- Authoring 5 new sections is the bulk of the work — stage by section (ship
  collections first).
- `simulateCSharp` can't truly execute C#; tightened validators reduce false
  positives but can't make it a compiler. Keep expectations labeled "expected
  output" not "actual output."

## 7. Validation

- For each new section: load learn → step every slide → exercise grades correctly.
- Run the OOP "Diameter" exercise with the old false-positive code → must now FAIL.
- Offline still works; progress badges update after a Learn session.

## 8. Decisions status

1. Topics to add? ✅ Decided = the 5 above (extended list phase 2).
2. Harden validators? ✅ Decided = yes.
3. Hints in Learn? ✅ Decided = yes.
4. Learn-progress persistence? ✅ Decided = yes (parity with quiz badges).

## 9. Validation steps

- Local dev: open each new learn file; confirm slides render + each exercise
  self-checks as expected.
- Confirm the hardened "Diameter" exercise rejects the previously-passing invalid
  code.
- Confirm `learnProgress` badge appears on a revisited section.
