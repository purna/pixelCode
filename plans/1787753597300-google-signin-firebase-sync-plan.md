# Plan: Google Sign-In + Classroom Submission & Firebase Sync for the C# Quiz PWA

Status: **Draft — refining.** See §8 for the one unresolved decision.

## 0. Definitions (resolving vague terms)

- **user / account** = a Google Account, uniquely identified by the Firebase Auth
  `uid` (stable per Google account × this Firebase project). This app has *no*
  notion of "user" today — everything is anonymous in `localStorage` — so
  introducing `uid` is the core change. There is no separate tenant/role model
  inside the app.
- **student** = any authenticated user who runs a quiz and submits a result.
- **teacher** = the person who creates the Google Classroom assignment; they do
  **not** log into this app for that. They author the destination link once.
- **attempt** = one completed quiz (section + level + variant + answers). Today
  only the aggregate (`quizResults[section|level]`) is persisted; this plan adds a
  full per-attempt document under `users/{uid}/attempts/`.
- **submission** = a Classroom `studentSubmission` created by the Function on the
  student's behalf.

## 1. Goals & scope

- **Item 1 (Classroom):** Student signs in with Google, finishes a quiz, clicks
  **Submit to Classroom**, and the result lands as a Classroom assignment
  *submission* the teacher can see in the assignment's classwork stream.
- **Item 2 (Firebase sync):** Student's `quizResults`, preferences, and full
  per-attempt answers persist to Firestore keyed by `uid`, so they survive a
  device/browser change.
- **In scope:** optional sign-in (app works offline/local when signed out),
  Firebase Auth, Firestore, one callable Cloud Function, Hosting deploy.
- **Explicitly out of scope (phase 2):** writing a numeric grade into the
  Classroom *gradebook* column. That needs the teacher-scoped
  `classroom.coursework.students` grading scope + a teacher OAuth flow — see §8.

## 2. Key decisions (recommended defaults)

| Decision | Recommended choice | Rationale |
|---|---|---|
| Auth provider | Firebase Auth Google provider (single shared sign-in) | One login serves both Classroom + Firestore; no custom backend |
| Classroom scope on sign-in | `openid email profile` + `.../classroom/coursework.me` | Needed so a submission token can be issued to the student |
| Submission API caller | Callable Cloud Function (proxy) | Static client can't hold an OAuth client secret; server-side call is robust |
| Access token freshness | Acquire at submit time via GIS Token Client, pass to Function | Tokens from sign-in expire (~1h); a fresh token per submit avoids expiry failures |
| Sign-in gating | Optional — signed-out = today's local-only behavior | Preserves offline/PWA experience |
| Firestore store | Firestore | Structured docs map to the existing `quizResults` shape |
| Firestore writes | Write-through: Firestore + `localStorage` | Local cache + offline behavior; Firestore offline cache queues when offline |
| Classroom destination | `?courseId=…&courseWorkId=…` on the teacher's assignment link | No teacher config screen in the app |
| Submission state | Draft, student turns in from Classroom | Avoids surprising auto-submission |

## 3. Prerequisite: the app must be served over HTTPS

OAuth redirect / popup + Classroom authorized-JS origins **require https** (or
`localhost`). Today the app is opened as local files. **Deploy to Firebase
Hosting** (or any https origin) so sign-in + Classroom scopes actually resolve.
Local dev uses `http://localhost` (allowed by Google). Flagged as task T0.

## 4. Affected components / files

- `firebase.json` + `.firebaserc` — project + Hosting (new).
- `firebase-config.example.js` (committed) + `firebase-config.js` (git-ignored,
  sets `window.FIREBASE_CONFIG`). Add `firebase-config.js` to `.gitignore`.
- `index.html` — load Firebase SDK + GIS SDK; add sign-in button + signed-in
  avatar to `.header-actions`; load `firebase-config.js` before `script.js`.
- `script.js` — refactor the IIFE into ES modules: `auth.js` (sign-in/out,
  `state.user`), `firestore-sync.js` (hydrate + double-writes), `classroom.js`
  (submit wiring on the results screen). Hooks at existing `saveQuizResult` and
  the settings/theme/tutorial writes. Render **Submit to Classroom** in
  `showResults()` when `state.user` exists and a Classroom assignment id is known.
- `functions/index.js` (new) — callable `createClassroomSubmission`.
- `functions/package.json` — `firebase-functions`, `firebase-admin`, `googleapis`.
- `SOURCE_OF_TRUTH.md` §8.2/§8.3 — doc already updated; tighten §7 wording re:
  "no secrets in the client."

## 5. Data flow

### Sign-in + Firestore sync
1. Click **Sign in with Google** → `signInWithPopup(auth, GoogleAuthProvider)`
   with `addScope('https://www.googleapis.com/auth/classroom.coursework.me')`.
   On success set `state.user = { uid, email, displayName, photoURL }`.
2. `hydrate(uid)`: read `users/{uid}/preferences` + `users/{uid}/results/*`. Merge
   with `localStorage` (per-doc newer-wins by `updatedAt`); write merged set back
   to both stores. If offline, skip silently → local-only.
3. Double-writes: `saveQuizResult()` also upserts
   `users/{uid}/results/{section|level}` and pushes a full
   `users/{uid}/attempts/{attemptId}` doc (with `answers`). Settings save also
   writes `users/{uid}/preferences`.
4. Offline: Firestore offline cache queues; `window.online/offline` toggles a
   "syncing…" badge.

### Classroom submission (the riskiest part)
1. Teacher creates the assignment; its Instructions contain:
   `https://quiz.example/?courseId=123&courseWorkId=abc`.
2. Student follows the link → app stores `classroom.destination` in
   `localStorage` (or the URL just needs to be active at submit time).
3. `showResults()` renders **Submit to Classroom** when `state.user` + a known
   `destination` exist. The `submitToClassroom()` payload =
   { section, level, variant, correct, total, pct, passed, date,
     attemptRef: `users/{uid}/attempts/{attemptId}` }.
4. Client asks **GIS Token Client** for a *fresh* access token scoped to
   `.../classroom/coursework.me` (re-consents only if the classroom scope wasn't
   granted at sign-in). Passes `{ idToken, classroomAccessToken, courseId,
   courseWorkId, payload }` to the callable Function.
5. Function: verify `idToken` via `admin.auth().verifyIdToken` (identity + `uid`),
   then `POST https://classroom.googleapis.com/v1/courses/{courseId}/courseWork/{courseWorkId}/studentSubmissions`
   with `{}` as the student. The new submission's `id` is written back to the
   attempt doc + a local `classroomSubmission` flag to prevent dupes.
6. The submission `title`/`text` = a one-line score summary
   (`"C# Variables — Intermediate: 14/15 (93%) — PASS"`). Full per-question
   answers are NOT pasted into Classroom (size limits); the teacher opens the
   app's per-Uid attempt (or a future teacher view) for full detail. Document
   this clearly so "graded inside Classroom" = status + score line, not full
   answer dump.

> Why a Function proxy instead of calling Classroom straight from the browser:
> the Classroom REST API *is* CORS-callable from a browser with the user's GSI
> access token, but it's brittle (token lifetime, scope re-consent UX, error
> surfacing). The Function keeps all of that server-side and only the auth
> token crosses the wire (it is short-lived and scoped). If a later pass wants
> pure-client calls for simplicity, that's a one-line change later.

## 6. Firestore data model & rules

```
users/{uid}/preferences   { theme, timerMinutes, timerEnabled,
                            pqTimerSeconds, pqTimerEnabled,
                            tutorialSeen, updatedAt }
users/{uid}/results/{section|level}  { attempts, bestPct, passed,
                                      lastVariant, history[], updatedAt }
users/{uid}/attempts/{attemptId}     { section, level, variant, correct,
                                      total, pct, passed, answers:{qid:value},
                                      date, attemptRef?, classroomSubmissionId?,
                                      updatedAt }
```

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## 7. Ordered task list

- [ ] T0. Host the app over https (Firebase Hosting) so OAuth + Classroom
      origins work; configure authorized JS origins + redirect URIs.
- [ ] T1. GCP project: enable Firebase Auth, Firestore, Functions, Classroom API;
        add web OAuth client; add classroom scope to the OAuth consent screen.
- [ ] T2. Add `firebase-config.example.js`, git-ignore `firebase-config.js`,
        add `firebase.json` + `.firebaserc`.
- [ ] T3. `index.html`: load Firebase + GIS SDKs, sign-in button + avatar.
- [ ] T4. `auth.js`: Firebase init, Google sign-in (with classroom scope),
        `state.user`, sign-out, hydrate trigger.
- [ ] T5. `firestore-sync.js`: merge/hydrate + double-write hooks into
        `saveQuizResult`, settings, theme, tutorial writes.
- [ ] T6. `classroom.js`: read destination from URL, render Submit button on
        `showResults()`, get fresh GSI access token, call Function, handle
        errors + duplicate guard.
- [ ] T7. `functions/`: `createClassroomSubmission` callable (verify idToken →
        POST Classroom API → write submission id back to the attempt doc).
- [ ] T8. Deploy Hosting + Functions; validate with a real teacher + student
        Google account in a test Classroom (see §9).

## 8. Risks & failure modes

- **Scope/UX:** Classrooms scope consent prompt is scary to students — explain
  why before requesting; request it at sign-in (not surprise-time).
- **Token expiry (the big one):** sign-in access tokens expire ~1h. Always fetch
  a fresh GSI token *at submit time*. Make the Function surface "token expired"
  so the client can re-prompt sign-in gracefully.
- **Consumer accounts:** no service-account impersonation for students; the
  submission must run as the student with their token (the proxy above handles
  this). Documented, do not attempt domain-wide delegation here.
- **Offline:** Firestore init failure must not block rendering — degrade to
  `localStorage`-only silently.
- **Privacy:** full per-question `answers` persist per-Uid; rules lock to
  `uid`. Add a student-facing note.
- **Duplicate submissions:** `classroomSubmission` flag + attempt timestamp;
  Function idempotent by `attemptId` (upsert the submission-id link).
- **Classroom payload limits:** don't paste full answers into the submission
  `text`; keep it a score summary + link to the attempt.

## 9. Open questions (confirm)

1. **(Decided — recommended) Sign-in optional?** Yes: signed-out = current
   local-only behavior. (Keeping as the default; flag if you want forced login.)
2. **(Decided — recommended) Draft vs auto-turn-in?** App creates a **draft**;
   student turns it in from Classroom. (Keeping as the default.)
3. **THE blocking decision — gradebook?** Do you need the score to appear in
   Classroom's **gradebook** (numeric grade column per student), or is a
   submission with a visible score line enough?
   - Recommended: **score line only** (phase 1). Writing grades needs the teacher
     `classroom.coursework.students` scope + a teacher OAuth flow (you, as the
     teacher, authorizing once), which is a separate server-side job.
   - If **yes, gradebook too**, phase 2 adds a teacher sign-in with that scope and
     a Function that PATCHes `studentSubmissions/{id}` →
     `assignedGrade` per student. This is materially larger scope and I'd treat
     it as a separate plan.

## 10. Validation

- Local: `python3 -m http.server` (https requirement means sign-in will be
  localhost-only dev until hosted) → sign in → run quiz → doc appears under
  `users/{uid}/attempts/` + `/results/` in the Firestore console.
- Sign in on a second browser as the same UID → data hydrates, newer-wins merge.
- In a test Classroom, follow a `?courseId=…&courseWorkId=…` link as a student;
  submit from Results → a submission (draft) appears in Classroom under that
  assignment with the score line.
- Disable network mid-flow → quizzes still run; on reconnect, Firestore sync
  completes and "syncing…" clears.
- Trigger the gradebook path only if §9 decision #3 is "yes."
