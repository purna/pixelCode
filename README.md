# pixelCode

A client-side, offline-first PWA for learning and quizzing C# programming. Content is authored as JSON and fetched at runtime, covering 40 C# topics across three difficulty tiers with interactive lessons, quizzes, and optional Google Classroom + Firebase sync.

## Tech Stack

- **HTML5** single-page shell (`index.html`)
- **Vanilla JavaScript (ES6+)** — modularized into `js/*.js`, loaded as plain script tags (no bundler)
- **CSS3** — custom-property-based theming with light/dark mode, no CSS framework
- **PWA** — installable via `manifest.webmanifest`, service worker caches the app shell
- **Firebase JS SDK v9** (compat mode) — Google sign-in, Auth, and Firestore sync
- **Google Identity Services** — sign-in support
- **Sortable.js 1.15.0** — drag-order quiz questions
- **No build step required** — serve the folder over HTTP(S) with any static server

## Features

### Learn Mode
- Slide-based lessons per section with interactive exercises: multiple choice, drag-and-drop, fill-in-the-blank, code (client-side simulated run), and Flow Builder
- Step-by-step execution player for code visualization
- Flow diagram rendering for control flow concepts
- Progressive hints on code exercises
- Seamless transition from the last lesson slide directly into that section's quiz

### Quiz Mode
- 10-question quizzes per section with randomized A/B/C variants
- Multiple interactive question types:
  - **scored** — single-select multiple choice
  - **insert** — pick a code snippet to fill a blank slot
  - **typing** — free-text blanks (case-insensitive matching)
  - **dragorder** — reorder lines via drag-and-drop
  - **coderunner** — edit and "run" code via heuristic validation
- Configurable global quiz timer (default 5 min, 0–20 min range)
- Optional per-question timer (default off, 10–300 s)
- 80% pass threshold with animated results screen
- Per-question review showing your answer, correct answer, and explanation

### Progress & Gamification
- Per-section completion badges rendered as animated SVG progress circles
- Gold star on pass, percentage circle on attempt, empty otherwise
- Per-section "Learn" badges (Learned / In progress)
- Overall progress bar with themed micro-copy and animated counter
- All progress persisted to localStorage

### Settings & Accessibility
- Night mode toggle (persisted, respects `prefers-color-scheme`)
- Settings modal for timer configuration and progress reset
- First-run 4-step tutorial (re-openable via the help button)
- Fully keyboard navigable

### Firebase & Google Classroom Integration
- Google sign-in button in the header
- Firestore sync of quiz results, preferences, and per-attempt records
- Offline-first: localStorage as the local cache, write-through to Firestore when online
- Submit quiz results directly to Google Classroom assignments
- Cloud Function (`createClassroomSubmission`) handles server-side Classroom API calls
- Teacher setup: create a Classroom assignment and paste the app link with `?courseId=...&courseWorkId=...` query parameters

### Offline-First PWA
- Service worker caches the app shell for offline use
- Installable on desktop and mobile

## Project Structure

```
pixelCode/
├── README.md                              # This file
├── SOURCE_OF_TRUTH.md                     # Authoritative design and authoring documentation
├── FIREBASE_CLASSROOM_INTEGRATION.md      # Step-by-step Firebase + Classroom setup guide
├── index.html                             # Single HTML shell: all screens as <main> sections
├── styles.css                             # All styling + light/dark theme tokens
├── script.js                              # Deprecated stub (functionality moved to js/*.js)
├── sw.js                                  # Service worker (app-shell cache)
├── manifest.webmanifest                   # PWA manifest
├── site.webmanifest                       # Legacy manifest (leftover)
├── flow-builder.html                      # Standalone launcher for the FlowBuilder component
├── firebase.json                          # Firebase Hosting config (SPA rewrite)
│
├── data/                                  # Content: JSON lessons + quizzes
│   ├── {section}-learn.json               # Lesson slides (41 files)
│   ├── {section}-quiz-A.json              # Quiz variant A (120 files)
│   ├── {section}-quiz-B.json              # Quiz variant B
│   └── {section}-quiz-C.json              # Quiz variant C
│
├── js/                                    # Application modules (loaded in order by index.html)
│   ├── firebaseConfig.js                  # Firebase init + Google sign-in + Classroom scope (git-ignored)
│   ├── firebase-config.example.js         # Committed template
│   ├── app.js                             # Root module: app.state, app.el, app.init, helpers
│   ├── storage.js                         # localStorage read/write for quizResults, learnProgress
│   ├── helpers.js                         # CSS var reader, canvas shape matrices
│   ├── settings.js                        # Theme toggle, timer settings, reset progress, tutorial gate
│   ├── progress.js                        # Completion badges, overall progress bar, animated counter
│   ├── learn.js                           # Learn slide rendering + all exercise renderers
│   ├── quiz.js                            # startQuiz, renderQuestion, all quiz renderers, simulateCSharp
│   ├── results.js                         # showResults, scored scoring + review rendering
│   ├── databaseManager.js                 # Firestore sync class + hydration
│   ├── classroom.js                       # Classroom submission button + callable Function call
│   └── flow-builder.js                    # FlowBuilder class: block-based flow-chart editor
│
├── functions/                             # Firebase Cloud Functions
│   ├── index.js                           # createClassroomSubmission callable function
│   └── package.json                       # Dependencies: firebase-admin, firebase-functions, node-fetch
│
├── .github/workflows/
│   └── static.yml                          # GitHub Pages deploy on push to main
│
└── favicon.*                              # Favicons and app icons
```

## Content Authoring

Content is JSON-driven — no code changes needed to add sections. See `SOURCE_OF_TRUTH.md` for the full authoring guide.

### Sections & Difficulty Tiers

**Beginner (20):** csharp-intro, csharp-syntax, csharp-output, csharp-comments, csharp-variables, csharp-datatypes, csharp-typecasting, csharp-userinput, csharp-operators, csharp-math, csharp-strings, csharp-booleans, csharp-conditions, csharp-switch, csharp-whileloop, csharp-forloop, csharp-breakcontinue, csharp-arrays, csharp-methods, csharp-methodparams

**Intermediate (11):** csharp-arrays-multi, csharp-methodoverloading, csharp-oop, csharp-classes, csharp-classmembers, csharp-constructors, csharp-accessmodifiers, csharp-properties, csharp-inheritance, csharp-polymorphism, csharp-collections, csharp-generics

**Expert (9):** csharp-abstraction, csharp-interfaces, csharp-enums, csharp-files, csharp-exceptions, csharp-linq, csharp-async, csharp-delegates

## Data Formats

### Quiz Files (`data/{section}-quiz-{A|B|C}.json`)

```json
{
  "meta": { "section": "...", "level": "...", "title": "..." },
  "questions": [
    {
      "id": "...",
      "type": "scored|insert|typing|dragorder|coderunner",
      "prompt": "...",
      "explanation": "...",
      "options": ["...", "..."],
      "answerIndex": 0
    }
  ]
}
```

### Learn Files (`data/{section}-learn.json`)

```json
{
  "section": "...",
  "title": "...",
  "slides": [
    {
      "title": "...",
      "content": "...",
      "example": "...",
      "exampleOutput": "...",
      "exercise": { "type": "multiplechoice|dragdrop|fillblank|code|flowbuilder", ... },
      "execution": { "code": "...", "steps": [...] },
      "flow": { "nodes": [...] }
    }
  ]
}
```

## Getting Started

### Running Locally

No build step is required. Serve the folder over HTTP(S):

```bash
npx serve .
# or
python3 -m http.server 3000
```

> Note: Google sign-in requires HTTPS. `localhost` is allowed for development.

Open `index.html` in your browser to use the app. Open `flow-builder.html` for the standalone Flow Builder tool.

### Enabling Firebase & Google Classroom

1. Create a Firebase project and enable Authentication (Google), Firestore, and Functions
2. Register a web app and copy the config to `js/firebaseConfig.js` (see `js/firebase-config.example.js` for the template)
3. Enable the Google Classroom API and add the `.../classroom/coursework.me` OAuth scope
4. Add your domain to Firebase Auth authorized domains and OAuth authorized JS origins
5. Deploy Firestore security rules and the Cloud Function using the Firebase CLI

See `FIREBASE_CLASSROOM_INTEGRATION.md` for the complete 11-step setup guide.

## Deploying

**Firebase Hosting:**
```bash
firebase deploy --only hosting
```

**GitHub Pages:**
Push to `main` — the GitHub Actions workflow in `.github/workflows/static.yml` handles deployment automatically.

## Architecture

The app is built around a single global `app` object. Each module in `js/` attaches methods and properties to `app`. Load order in `index.html` is deliberate:

1. Third-party libraries (Sortable.js, Firebase SDK, Google Identity Services)
2. `firebaseConfig.js` — Firebase initialization and auth
3. `databaseManager.js` — Firestore sync layer
4. `classroom.js` — Classroom submission integration
5. `app.js` — Root state, DOM element cache, initialization
6. `storage.js` — localStorage persistence
7. `helpers.js` — Utility functions
8. `settings.js` — Theme, timers, tutorial
9. `flow-builder.js` — Flow chart editor
10. `learn.js` — Learn mode rendering
11. `quiz.js` — Quiz mode rendering and scoring
12. `results.js` — Results screen
13. `progress.js` — Badges and progress bar

State flows through `app.state` for in-memory quiz data and localStorage for persistence. When Firebase is configured, Firestore acts as a write-through cache synced on login and after each quiz completion.

## Code Execution Note

The `coderunner` question type uses `simulateCSharp()` in `quiz.js` — a heuristic validator based on regex and string matching. It is **not** a real C# compiler and is intended for practice purposes only.
