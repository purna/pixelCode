# Plan: Google Sign-In + Classroom Submission & Firebase Sync for the C# Quiz PWA

Status: **Implementation-ready (phase 1)** — gradebook path deferred to §9 #3.

## 0. Definitions (resolving vague terms)

- **user / account** = a Google Account, uniquely identified by the Firebase Auth
  `uid` (stable per Google account × this Firebase project). This app has **no**
  notion of "user" today — everything is anonymous in `localStorage` — so
  introducing `uid` is the core change. No in-app tenant/role model.
- **student** = any authenticated user who runs a quiz and submits a result.
- **teacher** = the person who creates the Google Classroom assignment; they do
  **not** log into this app. They author the destination link once.
- **attempt** = one completed quiz (section + level + variant + answers).
- **submission** = a Classroom `studentSubmission` created by the Function.

## 1. Goals & scope

- **Item 1 (Classroom):** Student signs in with Google, finishes a quiz, clicks
  **Submit to Classroom**, and the result lands as a Classroom *submission* the
  teacher can see in the assignment's classwork stream.
- **Item 2 (Firebase sync):** Student's `quizResults`, preferences, and full
  per-attempt answers persist to Firestore keyed by `uid`, surviving
  device/browser changes.
- **Non-goals:** per-seat licensing; teacher-side gradebook writes (phase 2).

## 2. Key decisions (recommended defaults)

| Decision | Recommended choice | Rationale |
|---|---|---|
| Auth provider | Firebase Auth Google provider (one shared sign-in) | One login serves both features |
| Classroom scope on sign-in | `openid email profile` + `.../classroom/coursework.me` | Required to issue a submission token |
| Access token at submit | Fresh GSI Token Client call (scoped) | Sign-in tokens expire ~1h |
| Submission API caller | Callable Cloud Function (proxy) using the passed access token | Static client can't hold a secret |
| Sign-in gating | Optional (local use still works signed-out) | Preserves offline/PWA experience |
| Firestore store | Firestore | Structured docs map to `quizResults` shape |
| Firestore writes | Write-through: Firestore + `localStorage` | Offline cache + immediate local behavior |
| Classroom destination | `?courseId=…&courseWorkId=…` on the teacher's assignment link | No teacher config screen needed |
| Submission state | Draft; student turns in from Classroom | Avoids surprising auto-submission |

## 3. Prerequisite: serve over HTTPS

OAuth popup/redirect + Classroom authorized-JS origins require **https** (or
`localhost`). Deploy to Firebase Hosting (or any https origin) — local dev uses
http://localhost. Task **T0**.

## 4. Affected components / files

- `firebase.json` + `.firebaserc`, `firebase-config.example.js` (committed) +
  `firebase-config.js` (git-ignored, sets `window.FIREBASE_CONFIG`).
- `index.html` — Firebase + GIS SDKs; sign-in button + avatar in `.header-actions`.
- `script.js` → ES modules: `auth.js`, `firestore-sync.js`, `classroom.js`; wire
  **Submit to Classroom** into `showResults()`.
- `functions/index.js` + `functions/package.json` — callable
  `createClassroomSubmission`.
- `SOURCE_OF_TRUTH.md` §8.2/§8.3 (recommendations already recorded).

## 5. Data flow

### Sign-in + Firestore sync
1. Sign-in button → `signInWithPopup(GoogleAuthProvider)` with the classroom scope.
   Set `state.user = { uid, email, displayName, photoURL }`.
2. `hydrate(uid)`: read `users/{uid}/preferences` + `users/{uid}/results/*`. Merge
   with `localStorage` (newer-wins by `updatedAt`); write merged set back to both.
   Offline → skip silently, local-only.
3. Double-writes: `saveQuizResult()` upserts
   `users/{uid}/results/{section|level}` **and** creates a full
   `users/{uid}/attempts/{attemptId}` doc (with answers). Settings/theme/tutorial
   writes also persist to `users/{uid}/preferences`.
4. Firestore offline cache queues writes; `window.online/offline` toggles a
   "syncing…" badge.

### Classroom submission
1. Teacher's assignment Instructions = `https://quiz.example/?courseId=123&courseWorkId=abc`.
2. `showResults()` renders **Submit to Classroom** when `state.user` + a known
   destination exist; reads ids from `location.search`.
3. Click → client fetches a fresh GSI access token (classroom scope), calls
   `createClassroomSubmission({ idToken, classroomAccessToken, courseId,
   courseWorkId, payload })`.
4. Function: `admin.auth().verifyIdToken(idToken)` → assert `uid === request.auth.uid`
   → `POST .../courses/{courseId}/courseWork/{courseWorkId}/studentSubmissions` `{}`
   → write returned `id` to `attemptId.classroomSubmissionId` + local dupe flag.
5. Submission `title` = one-line score summary; full answers live at
   `users/{uid}/attempts/{attemptId}` (no answer dump in Classroom).

> Function-as-proxy rationale: Classroom REST is browser-callable with the user
> token, but it's brittle (token lifetime, consent UX). Server-side call is robust
> and reviewable.

## 6. Firestore model & rules

```
users/{uid}/preferences                 { theme, timerMinutes, timerEnabled,
                                          pqTimerSeconds, pqTimerEnabled,
                                          tutorialSeen, updatedAt }
users/{uid}/results/{section|level}     { attempts, bestPct, passed,
                                          lastVariant, history[], updatedAt }
users/{uid}/attempts/{attemptId}        { section, level, variant, correct,
                                          total, pct, passed,
                                          answers:{qid:value}, date,
                                          classroomSubmissionId?, updatedAt }
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

- [ ] T0. Deploy Hosting (https) + authorize OAuth origins/redirects.
- [ ] T1. GCP project: enable Firebase Auth, Firestore, Functions, Classroom API;
      web OAuth client; classroom scope on consent screen.
- [ ] T2. `firebase-config.example.js` (committed) + `firebase-config.js`
      (git-ignored); `firebase.json` + `.firebaserc`.
- [ ] T3. `index.html`: load Firebase + GIS SDKs; sign-in button + avatar.
- [ ] T4. `auth.js`: Firebase init, Google sign-in (classroom scope),
      `state.user`, sign-out, hydrate trigger.
- [ ] T5. `firestore-sync.js`: merge/hydrate + double-write hooks into
      `saveQuizResult`, settings, theme, tutorial writes.
- [ ] T6. `classroom.js`: destination from URL, Submit button on `showResults()`,
      fresh GSI token, Function call, errors + dupe guard.
- [ ] T7. `functions/`: `createClassroomSubmission` callable + rules.
- [ ] T8. Deploy + validate with real teacher/student accounts in a test
      Classroom (§10).

## 8. Risks & failure modes

- **Scope/UX:** classroom consent prompt is scary to students — explain first.
- **Token expiry:** always fetch a fresh GSI token at submit; surface
  "needs sign-in" on expiry.
- **Consumer accounts:** no service-account impersonation; student token required.
- **Offline:** Firestore init failure must not block rendering → localStorage only.
- **Privacy:** full answers persist per-Uid; student-facing note required.
- **Dupes:** `classroomSubmission` flag + idempotent Function by `attemptId`.
- **Payload limits:** score-line in Classroom; full detail stays in Firestore.

## 9. Decisions status

1. Sign-in optional? ✅ Yes (default). 2. Draft vs auto-turn-in? ✅ Draft.
3. **Gradebook?** ⏸ Phase 2 — needs teacher `classroom.coursework.students` scope
   + teacher OAuth flow. Not in phase 1.

## 10. Validation

- Local https-less dev (`http://localhost`): sign in, run quiz, confirm docs land
  under `users/{uid}/attempts/` + `/results/` in Firestore.
- 2nd browser, same UID → hydrate + newer-wins merge.
- Test Classroom: follow `?courseId=…&courseWorkId=…` link as a student; submit →
  draft submission appears in Classroom with the score line.
- Offline: quizzes still run; reconnect → syncs.
- Grader path only if §9 #3 promoted to phase 1.
