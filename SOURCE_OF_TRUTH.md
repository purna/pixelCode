# Assessment Quiz — Source of Truth

This is the single reference for how the quiz app is structured, how content
is authored, and how the app behaves. If code and this document ever disagree,
this document wins — fix the code.

> **Status note (2026-08):** this document was rewritten to match the *current*
> app. The original was modelled on `purna/quiz` (static site, no framework,
> JSON-driven questions, dark mode, settings panel, difficulty toggle). The app
> has since become a **C# Quiz** with a Learn mode plus a Quiz mode, quiz
> variants (A/B/C), three difficulty levels, and several interactive question
> types. The original visual/pyramid/cluster-matrix/profiled renderers still
> exist in `script.js` but are **not used** by any current data file — see
> §8 (Recommendations) for cleanup notes.

---

## 1. File structure

```
quiz/
├── SOURCE_OF_TRUTH.md       ← this file
├── index.html                ← single page shell (all screens live here)
├── styles.css                ← all styling, incl. light/dark theme tokens
├── script.js                 ← all app logic (vanilla JS, no dependencies)
├── manifest.webmanifest      ← PWA manifest (installable, offline-ready)
├── sw.js                     ← service worker (caches app shell for offline use)
└── data/
    ├── {section}-learn.json         ← learn slides for a section
    ├── {section}-quiz-A.json        ← quiz variant A
    ├── {section}-quiz-B.json        ← quiz variant B
    ├── {section}-quiz-C.json        ← quiz variant C
    └── {section}-quiz.json          ← fallback quiz (used if a variant is missing)
```

- `index.html` loads two third-party CDN scripts: CodeMirror CSS (styles only,
  currently unused for input) and Sortable.js (drag-and-drop ordering support).
- No build step, no framework, no bundler. Content is JSON fetched at runtime.
- Add a new section by adding a `.section-card` in `index.html` and creating its
  `data/{section}-learn.json` plus one or more `data/{section}-quiz-*.json` files.
  The app reads the section id and level straight off the card and builds the
  fetch path.

Naming convention for data files: `data/{section}-{kind}.json` where
`{kind}` is `learn` or `quiz` (optionally suffixed `-A`/`-B`/`-C`).

---

## 2. Sections & levels

Each section is a **card** in `index.html` with two attributes:

| attribute        | value            | example            |
|------------------|------------------|--------------------|
| `data-section`   | section id       | `csharp-variables` |
| `data-level`     | difficulty tier  | `beginner`         |

Three tiers exist in the current content: **beginner**, **intermediate**,
**expert**. (The old doc described `basic`/`advanced`; that model is gone —
the level is now read from the card's `data-level`, not a global toggle.)

Current sections:

- beginner — csharp-intro, csharp-syntax, csharp-output, csharp-comments,
  csharp-variables, csharp-datatypes, csharp-typecasting, csharp-userinput,
  csharp-operators, csharp-math, csharp-strings, csharp-booleans,
  csharp-conditions, csharp-switch, csharp-whileloop, csharp-forloop,
  csharp-breakcontinue, csharp-arrays, csharp-methods, csharp-methodparams
- intermediate — csharp-arrays-multi, csharp-methodoverloading, csharp-oop,
  csharp-classes, csharp-classmembers, csharp-constructors,
  csharp-accessmodifiers, csharp-properties, csharp-inheritance,
  csharp-polymorphism, csharp-collections, csharp-generics
- expert — csharp-abstraction, csharp-interfaces, csharp-enums, csharp-files,
  csharp-exceptions, csharp-linq, csharp-async, csharp-delegates

Each card has two buttons — **Learn** (`.learn-btn[data-section]`) and
**Quiz** (`.quiz-btn[data-section]`). The level is inherited from the parent
card; the section id comes from the button's `data-section`.

---

## 3. Content data formats

### 3.1 Quiz files — `data/{section}-quiz-{variant}.json`

Quiz questions are fetched per section. At quiz start the app picks a random
variant from `A`/`B`/`C` and fetches `data/{section}-quiz-{variant}.json`,
falling back to `data/{section}-quiz.json` if that file is missing. The chosen
variant is stored in `state.quizVariant` (in-memory only).

Common fields on every question:

| field    | type   | notes                                         |
|----------|--------|-----------------------------------------------|
| `id`     | string | unique within the file; the DOM/state key     |
| `type`   | string | one of the question types in §3.2             |
| `prompt` | string | plain text (never HTML-injected)              |
| `explanation` | string | optional; shown on the results review screen |

`meta` block per file:

```json
{ "meta": { "section": "csharp-variables", "level": "beginner", "title": "C# Variables" } }
```

### 3.2 Question types in use

These are the shapes actually present in `data/`. The renderer also supports
the legacy shapes from §3.3 (pyramid / visual / cluster-missing / matrix-3×3 /
profiled / multi-select) but **none of them appear in the current data**; their
renderers are retained only for reference (see §8).

#### 3.2.1 `scored` — multiple choice

```json
{
  "id": "csharp-variables-01",
  "type": "scored",
  "prompt": "How do you declare an integer variable named count set to 5?",
  "options": ["int count = 5;", "count int = 5;", "integer count = 5;", "var count = 5int;"],
  "answerIndex": 0,
  "explanation": "C# variable declaration is: type name = value; so int count = 5;."
}
```

- `answerIndex` is zero-based into `options`.

#### 3.2.2 `insert` — fill-in-the-blank code slot

```json
{
  "id": "csharp-variables-03",
  "type": "insert",
  "prompt": "Fill in the blank to declare a constant PI",
  "template": "______;",
  "options": ["CONST DOUBLE PI = 3.14", "const double PI = 3.14s", "Const double pi = 3.14", "const double PI = 3.14"],
  "answerIndex": 3
}
```

- `template` contains `______` as the insertion point. The player picks one
  `options` entry; scoring compares the chosen option index to `answerIndex`.

#### 3.2.3 `typing` — free-text blanks

```json
{
  "id": "csharp-output-02",
  "type": "typing",
  "prompt": "Complete the code to print Hello World",
  "template": "______(\"Hello, World!\");",
  "blanks": ["Console.WriteLine"]
}
```

- `blanks` is an array of expected strings (one per `______` in `template`,
  though typically one slot). Scoring is case-insensitive, trimmed.

#### 3.2.4 `dragorder` — reorder a list

```json
{
  "id": "csharp-oop-05",
  "type": "dragorder",
  "prompt": "Drag these lines into the correct order",
  "items": ["public class Dog {}", "static void Main()", "{", "Console.WriteLine(\"Woof\");", "}"],
  "solution": [1, 3, 0, 4, 2]
}
```

- `items` are the draggable strings; `solution` is the correct order expressed
  as the original indices of `items`. Scoring compares the player's ordered
  indices to `solution` (JSON-compared).

#### 3.2.5 `coderunner` — edit & run code

```json
{
  "id": "csharp-abstraction-05",
  "type": "coderunner",
  "prompt": "Create abstract class Animal with Sound() and class Cow ...",
  "starterCode": "using System;\nabstract class Animal { public abstract string Sound(); } ... \nclass Program { static void Main() { ______ } }",
  "outputPattern": "^Moo\\n$",
  "expectedOutput": "Moo\n",
  "explanation": "Concrete subclass implements abstraction."
}
```

- `starterCode` is the initial editor content. `outputPattern` is a regex
  tested against the code text (the app runs a **client-side simulator**, not a
  real compiler — see §8). `expectedOutput` is shown to the student on success.
  Optional `hints` array may provide progressive hints.

### 3.3 Legacy question types (documented, not used in current data)

The renderers exist in `script.js` but no current JSON uses them. Retained for
reference only; candidates for removal (§8):

- `pyramid` — number-pyramid drag-and-drop (`rows`, `tiles`, `solutions`).
- `visual` — canvas-rendered shape-rotation sequences (`sequence`, `options`
  as shape descriptors, `answerIndex`).
- `cluster-missing` — three-rule number clusters (`clusters`, `options`,
  `answerIndex`).
- `matrix-3x3` — Raven-style matrix (`grid`, 6 `options`, `answerIndex`).
- `profiled` — personality/situational trait tallies (`options` with `trait`
  keys, `meta.traits`).
- multi-select — `scored`-style questions carrying a `correctIndices` array
  instead of `answerIndex`.

### 3.4 Learn files — `data/{section}-learn.json`

```json
{
  "section": "csharp-variables",
  "title": "C# Variables",
  "slides": [
    {
      "title": "Declaring Variables",
      "content": "Declare a variable by specifying its type, then a name...",
      "example": "string name = \"Alice\";\nint score = 100;",
      "exampleOutput": "",
      "exercise": {
        "type": "dragdrop",
        "prompt": "Choose the correct keyword to declare an integer.",
        "before": "",
        "after": " age = 25;",
        "options": ["int", "integer", "num", "Int"],
        "answer": "int"
      }
    }
  ]
}
```

Learn exercise types: `multiplechoice`, `dragdrop`, `fillblank`, `code`.

| exercise type | required fields | notes |
|---------------|-----------------|-------|
| `multiplechoice` | `prompt`, `options[]`, `answer` | one correct string |
| `dragdrop` | `prompt`, `before`, `after`, `options[]`, `answer` | drop a value into the `_____` slot |
| `fillblank` | `prompt`, `answer`, optional `caseSensitive` | free-text input |
| `code` | `starterCode`, optional `expectedOutput`/`outputPattern`/`requiredStrings` | live "Run" simulates output |

Every exercise type also accepts an optional `hints[]` array of progressive
hints; the learner shows the first hint and reveals more on each click.

A slide may also carry `example` + `exampleOutput`, `execution` (a step-by-step
player), or `flow` (a flow diagram) instead of an exercise.

---

## 4. App behavior

### 4.1 Screens (all within `index.html`, toggled via `.hidden`)

0. **Tutorial** (`#tutorialScreen`) — four steps: pick a topic, Learn vs Quiz,
   free navigation + progress bar + timers, and results/review. Shown before a
   person's first attempt; dismissing it via "Got it — let's start" sets
   `quizTutorialSeen` in `localStorage`. Reopen any time via the ❔ header
   button (does not reset the seen flag).
1. **Section selection** (`#sectionSelection`) — three level groups
   (Beginner / Intermediate / Expert), each a row of `.section-card` tiles with
   Learn + Quiz buttons and a completion badge.
2. **Learn** (`#learnScreen`) — slide pager: title, content, example, optional
   interactive exercise (rendered into `#exerciseArea`), Previous / Next /
   Skip-to-Quiz. "Next" on the final slide starts that section's quiz.
3. **Quiz** (`#quizContainer`) — progress bar, one question at a time in
   `#questionContainer`, Previous / Next (becomes "Finish" on the last
   question).
4. **Results** (`#resultsContainer`) — score + per-question review (your answer,
   correct answer, explanation), plus "Retry this section" and
   "Back to sections".

### 4.2 Timers

**Quiz timer** (header countdown):
- On by default; configured in Settings (⚙️): 0–20 minutes, default 5.
- Counts down and auto-submits (calls `showResults()`) at `00:00`.
- Persisted under `quizTimerMinutes` / `quizTimerEnabled`.

**Per-question timer**:
- Off by default; Settings: enable + seconds (10–300, default 30).
- Shows a small header countdown per question; resets on each new question.
- When it hits 0 it calls `lockCurrentQuestion()`: for `pyramid` questions this
  locks tiles/cells (no longer interactive); for all other types it just hides
  the timer (the existing answer stands).
- Persisted under `quizPqTimerSeconds` / `quizPqTimerEnabled`.

### 4.3 Night mode

- Toggle (🌙/☀️) in the header, top-right.
- Persisted under `quizTheme` (`"light"` | `"dark"`).
- Respects `prefers-color-scheme` on first visit if no saved preference.
- Implemented via `data-theme="dark"` on `<html>` plus CSS custom-property
  tokens in `styles.css` — no separate dark stylesheet. Toggling re-renders the
  visible canvas question / results because canvas pixels are not theme-reactive.

### 4.4 Settings modal

- Opened via ⚙️. Controls: quiz timer duration + enable, per-question timer
  duration + enable, and "Reset all progress" (deletes `quizResults`, prefs,
  theme, and tutorial-seen flag, then reloads).
- Designed to be extended — add a new `.settings-section` block with a
  matching `localStorage` key.

### 4.5 Scoring

- `scored`: correct when chosen index === `answerIndex`.
- `insert`: correct when chosen option === `answerIndex`.
- `typing`: correct when every entered blank matches `blanks` (case-insensitive,
  trimmed).
- `dragorder`: correct when ordered indices equal `solution`.
- `coderunner`: correct when `simulateCSharp()` returns `ok: true`.
- Score = correct / total as a percentage; **pass threshold is 80%**.
- On the results screen each question is reviewable: the student's answer, the
  correct answer, and `explanation` (if present).

### 4.6 Completion badges & overall progress

- `quizResults` (localStorage) stores per-section status; cards re-render
  `completion-badge` icons via SVG progress circles after each attempt
  (gold star on pass ≥80%, hollow circle with % on any prior attempt, empty
  otherwise).
- Each section card also shows a small **Learn badge** next to the section mark,
  read from `learnProgress`: "✓ Learned" (completed) or "• In progress"
  (partially viewed); empty for untouched sections.
- The header **Overall Progress** bar shows the share of topics passed, with
  themed micro-copy and an animated counter.

---

## 5. Persistence (localStorage)

All persistence is client-side `localStorage` only. Nothing is currently sent
to a server.

| key                | value                                              | used for |
|--------------------|----------------------------------------------------|----------|
| `quizResults`      | object keyed by `section\|level` (see below)        | badges/progress |
| `quizTheme`        | `"light"` \| `"dark"`                              | night mode |
| `quizTimerMinutes` | number (0–20)                                      | quiz timer |
| `quizTimerEnabled` | `"true"` \| `"false"`                              | quiz timer |
| `quizPqTimerSeconds` | number (10–300)                                  | per-question timer |
| `quizPqTimerEnabled` | `"true"` \| `"false"`                            | per-question timer |
| `quizTutorialSeen` | `"true"`                                           | tutorial gate |

`quizResults` schema, one entry per `section\|level`:

```jsonc
{
  "csharp-variables|beginner": {
    "attempts": 2,
    "bestPct": 93,
    "passed": true,
    "lastVariant": "B",
    "history": [
      { "variant": "B", "pct": 93, "correct": 14, "total": 15, "date": "2026-08-26T..." }
    ]
  }
}
```

- `learnProgress` (per `section\|level`): `{ index, completed, total }` — stores
  the current slide index and whether Learn was completed; "Reset all progress"
  clears it.
- Quiz progress/answers during an attempt are **in-memory only** and reset on
  reload (mirrors the reference app).
- "Reset all progress" (Settings) clears every key above plus reload.

---

## 6. Authoring checklist

To add a new section end-to-end:

1. Add a `.section-card[data-section="x"][data-level="tier"]` in `index.html`,
   with Learn + Quiz buttons.
2. Create `data/x-learn.json` (slides + exercises, §3.4).
3. Create quiz file(s) `data/x-quiz-A.json`, `data/x-quiz-B.json`,
   `data/x-quiz-C.json` (or a single `data/x-quiz.json` fallback).
4. Pick question `type` from §3.2 and set the matching fields. For scored /
   insert, double-check `answerIndex` after any `options` edit.
5. No JS changes — the app builds the fetch path from the card/section/variant.
6. Validate data shape: `answerIndex` in range (scored/insert), non-empty
   `blanks` (typing), `solution.length === items.length` (dragorder), and every
   `code`/`coderunner` exercise has an `expectedOutput`, `outputPattern`, or
   `requiredStrings`.

---

## 7. Architecture notes / constraints

- **Static + offline-first**: PWA (manifest + `sw.js`) caches the app shell.
  External CDN scripts (CodeMirror CSS, Sortable.js) are loaded unpkg-style;
  offline use therefore depends on network or SW caching of those URLs.
- **`simulateCSharp` is a heuristic, not a real compiler**: `coderunner` checks
  the edited source against `outputPattern` (a regex over the code text),
  `requiredStrings`, and `expectedOutput`. It cannot execute C#. This is fine
  for practice hints but must not be presented as real compilation.
- **No secrets in the client**: there is currently nowhere to host a backend.
  Any server-side integration (Google Classroom, Firebase admin) must run in
  Cloud Functions / Firebase Functions rather than in `script.js`.

---

## 8. Recommendations

### 8.1 Cleanup candidates (low-priority tech debt)

- `script.js` still defines renderers for `pyramid`, `visual`,
  `cluster-missing`, `matrix-3x3`, and `profiled` plus multi-select
  (`correctIndices`) handling in `renderScoredResults`, but **no data file uses
  them**. They are dead weight for the C# quiz. Either (a) delete them to slim
  the bundle and reduce maintenance, or (b) keep them behind a documented
  "extended question types" opt-in if abstract-reasoning sections are
  planned later. Recommend (a) unless those sections are being reintroduced.
- `coderunner` scoring via `simulateCSharp` is regex/string-based. If
  `coderunner` questions grow, consider a small real evaluator (e.g. a
  sandboxed transpile-to-JS of a C# subset) or clearly label output as
   "expected" rather than "actual" to avoid misleading students.

### 8.1b Staged phase-2 work (content polish)

These findings are real but bulk-authored and explicitly staged by the plan
(§6 warns "authoring is the bulk of the work — stage by section"). They are
tracked by the data linter (every code exercise must have a validator; every
`dragorder` `solution.length` must equal `items.length`; every `scored`/`
insert` `answerIndex` must be in range). Do not ship partial fixes that let a
validator pass against wrong data.

- **`hints[]`** on the remaining 49 Learn `code` exercises — DONE. Two
  progressive, exercise-specific hints were added to all 49 (keyword pointer +
  expected-output pointer, derived from each exercise's `requiredStrings` /
  `expectedOutput`). Verified: `exampleout_validate.py` now reports 0
  `code exercise: no hints`; canonical `learn_validate.py` still reports 0
  problems.
- **Empty `exampleOutput`** on runnable code-example slides whose printed output
  was left blank — 142 slides remain. Fill each with the snippet's actual output.
  (Slides whose `example` is a class/struct/type definition have no output and
  legitimately stay empty — skip those.)
- **Remaining phase-2 topics** (§3 decision): nullable reference types, records,
  and pattern matching (the extended list). async/await, generics, and
  delegates/events are now implemented.
- **`csharp-intro-learn`** content-only slides with empty example/exampleOutput
  (cited in finding #3).

Collections, LINQ, async/await, generics, and delegates/events (each with
A/B/C/base quizzes + cards) are complete and validated; the `hints[]`
phase-2 item (T4) is remediated; findings #1–#6 are either remediated or
staged above.

### 8.2 Feature: Google sign-in + Google Classroom submission (Item 1)

**Goal.** A student signs in with a Google Account, finishes a quiz, and
submits the result to a Google Classroom assignment so the teacher can see it
graded inside Classroom.

**Design summary.** Classroom is an LTI/assignment flow, not a results
database. The teacher **creates the assignment in Google Classroom** and gives
students a link that points back to this app carrying the course + coursework
ids (e.g. `https://quiz.example/?courseId=123&courseWorkId=abc`). On the
results screen, an authenticated student clicks **Submit to Classroom**, which
creates a `studentSubmission` on that coursework via the Classroom API.

**Recommended stack.** Firebase Authentication (Google provider) for the login
state, plus a **callable Cloud Function for Firebase** to call the Classroom
API server-side — this keeps any OAuth bookkeeping/server-side handling off the
static client and avoids storing secrets in the PWA.

**Implementation plan.**

1. **Project / API setup.**
   - Create a Google Cloud project (or reuse the Firebase project from 8.3).
   - Enable **Google Identity Services** + **Google Classroom API** +
     **Firebase Auth** scopes.
   - Configure the **Google Cloud OAuth client** (Web app) with the
     Classroom scopes the app will request:
     `https://www.googleapis.com/auth/classroom.coursework.me`
     (students can create/turn in their own submissions). Teachers grading
     scores would additionally need
     `https://www.googleapis.com/auth/classroom.coursework.students`, which
     must be consented to by a teacher account — avoid requesting this scope
     from student logins.
   - Add the domain to the OAuth consent screen's authorized JavaScript
     origins and redirect URIs.

2. **Auth in the header (`index.html` + `script.js`).**
   - Add a **Sign in with Google** button to `.header-actions` (next to the
     theme/settings/help icons). On success it stores `state.user = {
     uid, displayName, email, photoURL }` (Firebase) and shows the avatar.
   - A signed-out user can still use the app locally as today; Classroom
     submission is simply gated behind the login.

3. **Results screen wiring (`script.js`, `showResults`).**
   - Build the same results payload you already compute (`section`, `level`,
     `variant`, `correct`, `total`, `pct`, `passed`, `history`, and —
     optionally — the full per-question `answers` for the report) into a plain
     object (`submissionPayload`).
   - Append a **"Submit to Classroom"** button to the results `actions` bar,
     rendered only when `state.user` exists. Read `courseId` /
     `courseWorkId` from `location.search` (or from a per-user saved
     preference if the teacher always posts the same assignment).

4. **Create the student submission (server-side).**
   - Button handler: call a callable Firebase Function
     `createClassroomSubmission({ courseId, courseWorkId, payload })`, passing
     the signed-in user's Firebase `idToken` (the function verifies the caller
     is the same Google account).
   - The function exchanges the GCS (Google Classroom Service) using the user's
     OAuth refresh/access token obtained via **Google Identity Services Token
     Client** (scoped to `classroom.coursework.me`), then:
     `POST https://classroom.googleapis.com/v1/courses/{courseId}/coursesCourseWork/{courseWorkId}/studentSubmissions`
     with `{}`. The body is the submission content the API accepts
     (`text` — the score/review string; attachments are limited, so put the
     full JSON result in `text` or as a Drive file link if large).
   - Optionally call `PATCH .../studentSubmissions/{id}` to set
     `state= TURNED_IN` so it shows as handed-in, or leave it as a draft for
     the teacher to inspect.

5. **Error handling.** Surface Classroom API errors to the student (e.g.
   "You're not enrolled in this class", "Assignment not found") and keep a
   local `classroomSubmission` record in `localStorage` so re-submitting isn't
   accidental.

6. **Teacher side.** The teacher creates the assignment in Classroom and
   appends `?courseId=...&courseWorkId=...` to the link posted in the
   assignment Instructions. No code changes needed by teachers — the query
   params carry the destination.

> **Constraint:** a fully client-side Classroom submission is possible using
> the GIS access-token with the student scope, but it is more fragile (CORS +
> scope-approval UX) and can't be tested without a real Classroom. The
> Function-based route above is the recommended, reviewable path.

### 8.3 Feature: Sync localStorage → Firebase per Google account (Item 2)

**Goal.** Persist each student's existing `quizResults`, preferences, and
completed answers into a cloud database keyed to their Google Account, so
progress survives a device/browser change and is visible to the teacher
side-by-side with Classroom submissions.

**Design summary.** Use **Firebase Authentication (Google provider)** — the same
sign-in from §8.2 — plus **Firestore** (or Realtime DB; Firestore is
recommended for structured per-user documents). Keep `localStorage` as an
offline cache and **write-through** to Firestore on every save, hydrating from
Firestore on login/startup.

**Implementation plan.**

1. **Add the Firebase SDK.** In `index.html`, add the modular Firebase SDK
   (compat is available but modular is preferred) before `script.js`, loading
   from the same CDN strategy the app already uses.

2. **Runtime config without a build step.** Add a tiny, git-**ignored**
   `firebase-config.js` that exposes `window.FIREBASE_CONFIG` (a
   `firebase-config.example.js` is committed as a template). `sw.js` should
   cache the example file only; the real config is never committed. Initialize
   Firebase once from that config.

3. **Sign-up flow.** Reuse the §8.2 Google sign-in button. On success, store
   `state.user = { uid, email, displayName, photoURL }` and start the sync
   hydration below.

4. **Firestore data model** keyed by the Firebase UID (`uid`):

   ```
   users/{uid}/preferences   (1 doc)            { theme, timerMinutes, timerEnabled, pqTimerSeconds, pqTimerEnabled, tutorialSeen }
   users/{uid}/results/{section|level}        (mirrors localStorage quizResults entry)
   users/{uid}/attempts/{attemptId}           full per-question attempt record for long-term review:
              { section, level, variant, correct, total, pct, passed,
                answers: { qid: value, ... }, date }
   ```

5. **Sync strategy (localStorage as cache).**
   - **On first sign-in / startup with a user:** load
     `users/{uid}/results` + `preferences` into memory, **merge** with any
     `localStorage` data (local wins on timestamp for results; prefer server
     for the authoritative record), then re-write the merged set into
     `localStorage` and onto Firestore.
   - **On every current save** (results after a quiz, settings save, theme
     toggle, tutorial dismiss): write to Firestore immediately AND keep the
     `localStorage` key intact, so the app stays functional offline.
   - **On sign-out / no user:** behave exactly as today (localStorage only).

6. **Security rules.** Lock everything to the authenticated user:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null
                            && request.auth.uid == uid;
       }
     }
   }
   ```

7. **Offline / PWA fit.** Firestore's offline cache (`enableIndexedDbPersistence`)
   makes writes queue locally when offline; the SW already caches the shell, so
   the app keeps working offline and syncs when connectivity returns. Flag
   `navigator.onLine` and show a small "syncing…" indicator in the header when
   online again.

8. **Wire to 8.2.** Because both features share the Google sign-in, build them
   together: one sign-in button, one `state.user`, and the Classroom submission
   function reuses the authenticated UID for its audit trail. The
   `submissionPayload` from §8.2 can be read back from `users/{uid}/attempts/`
   so a submission always references the saved attempt.

---

## 9. Verification

There is **no build step, lint script, or typecheck** for this vanilla-JS PWA
(the only npm dependency in the repo is the local Kilo plugin tool). To validate
changes to authoring/content:

- Open `index.html` in a browser (or serve the folder, e.g.
  `npx serve .` / `python3 -m http.server`).
- Confirm each section card loads its `*-learn.json` and a `*-quiz-*.json`
  variant without 404s (check the Network tab).
- Confirm `quizResults`, `quizTheme`, and the other localStorage keys in §5 are
  set as expected after interacting.
- When adding a question type, grep `script.js` `renderQuestion()` to confirm
  the branch exists for that `type`; if absent, a new `render<Type>()` plus a
  scoring branch in `renderScoredResults()` must be added.

(End of file)
