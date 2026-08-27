# Firebase + Google Classroom Integration Guide

This document explains how to provision the Firebase project, enable the required APIs, configure local settings, deploy the Cloud Function, and validate the full sign-in / Firestore sync / Classroom submission flow for this quiz app.

## 0. Prerequisites

- A Google account with access to [Google Cloud Console](https://console.cloud.google.com/)
- [Node.js 18+](https://nodejs.org/) and [Firebase CLI](https://firebase.google.com/docs/cli) installed
- The app served over **HTTPS** (or `localhost` for development). OAuth popups and Classroom authorized origins require HTTPS.

## 1. Create the Firebase project

```bash
# 1.1 Create a new project in the Firebase console (or use an existing one).
# 1.2 Note the project ID; you will need it below.

# 1.3 Enable required services in Firebase console:
#     - Authentication → Sign-in method → Google (enable)
#     - Firestore Database → Create database (start in test mode, rules added in §5)
#     - Functions → Upgrade to Blaze plan if not already (required for HTTPS callables)

# 1.4 Enable required Google Cloud APIs:
gcloud services enable firebaseauth.googleapis.com \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  classroom.googleapis.com
```

## 2. Configure the web app

### 2.1 Add a web app in Firebase console

In **Project Settings → General → Your apps → Web**, register a new web app.
Copy the `firebaseConfig` object.

### 2.2 Local config file

```bash
# Copy the example config
cp js/firebase-config.example.js js/firebase-config.js
```

Edit `js/firebase-config.js` and paste your config values:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

`js/firebase-config.js` is git-ignored. Keep `js/firebase-config.example.js` committed as a template.

## 3. Set up Google OAuth consent and Classroom scope

### 3.1 OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen** in Google Cloud Console.
2. Choose **External** (unless you have Google Workspace).
3. Fill in the required fields: app name, support email, developer contact.
4. Add the `.../classroom/coursework.me` scope under **Scopes for Google APIs**.
5. Add your domain to **Authorized JavaScript origins** (e.g. `https://quiz.example.com`).
6. Add `https://quiz.example.com` to **Authorized redirect URIs** (if using redirect flow).

### 3.2 Authorized domains in Firebase

In **Firebase Console → Authentication → Settings → Authorized domains**, add your production domain (e.g. `quiz.example.com`) in addition to the defaults.

## 4. Set up Firebase Hosting (optional but recommended)

```bash
# Initialize Firebase in the project if not already done
firebase init hosting

# When prompted:
# - Use an existing project (select the one created in §1)
# - Public directory: . (root)
# - Single-page app: No
# - Set up automatic builds with GitHub: No (unless desired)

# Deploy
firebase deploy --only hosting
```

This gives you an HTTPS origin automatically, satisfying the OAuth requirement.

## 5. Firestore security rules

In **Firebase Console → Firestore → Rules** (or deploy via CLI), use:

```js
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

To deploy via CLI:

```bash
firebase deploy --only firestore:rules
```

## 6. Deploy the Classroom submission Cloud Function

### 6.1 Create the functions directory

```bash
mkdir -p functions
cd functions
npm init -y
npm install firebase-admin firebase-functions
```

### 6.2 Write the function

Create `functions/index.js`:

```js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1';

async function createSubmission(idToken, classroomAccessToken, courseId, courseWorkId, attemptId, scoreLine) {
  const userSnap = await admin.auth().verifyIdToken(idToken);
  const uid = userSnap.uid;

  const res = await fetch(
    `${CLASSROOM_BASE}/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${classroomAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: scoreLine || 'Quiz submission'
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Classroom API error ${res.status}: ${text}`);
  }

  const submission = await res.json();

  await admin.firestore().collection(`users/${uid}/attempts`).doc(attemptId).set({
    classroomSubmissionId: submission.id,
    classroomState: submission.state || 'CREATED',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return submission;
}

exports.createClassroomSubmission = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const { idToken, classroomAccessToken, courseId, courseWorkId, attemptId, scoreLine } = data;

  if (!classroomAccessToken || !courseId || !courseWorkId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    const submission = await createSubmission(idToken, classroomAccessToken, courseId, courseWorkId, attemptId, scoreLine);
    return { success: true, submission };
  } catch (error) {
    console.error('createClassroomSubmission error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
```

### 6.3 Deploy the function

```bash
firebase deploy --only functions
```

Note the function URL/name; the client calls `createClassroomSubmission` via the Firebase SDK.

## 7. Local development

```bash
# Serve locally (HTTPS for OAuth)
npx serve .
# or
python3 -m http.server 3000

# In another terminal, optionally run the Firebase emulator
firebase emulators:start --only functions
```

Update `js/firebase-config.js` to point to localhost if using the emulator:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  // ...
};
```

## 8. Verify the integration

### 8.1 Sign-in flow

1. Open the app in a browser.
2. Click the **🔑 Sign in** button in the header.
3. Confirm the Google sign-in popup completes.
4. Check the browser console for `Auth state changed: signed in as ...`.
5. Verify `app.state.user` is populated (DevTools → Application → Local Storage).

### 8.2 Firestore sync

1. After signing in, complete a quiz.
2. Go to **Firebase Console → Firestore → Data**.
3. Verify a document exists at `users/{uid}/results/{section|level}`.
4. Verify a document exists at `users/{uid}/attempts/{attemptId}`.
5. Refresh the page and confirm progress is hydrated from Firestore.

### 8.3 Classroom submission

1. Open the app with a Classroom destination URL:
   ```
   https://quiz.example.com/?courseId=12345&courseWorkId=abcde
   ```
2. Sign in if not already.
3. Complete a quiz.
4. On the results screen, click **Submit to Classroom**.
5. Verify a draft submission appears in the teacher's Google Classroom assignment.
6. Check the Cloud Function logs in Firebase Console for any errors.

## 9. Teacher setup

No code changes are needed by teachers.

1. In Google Classroom, create an assignment.
2. In the assignment **Instructions**, paste the quiz URL with query params:
   ```
   https://quiz.example.com/?courseId=12345&courseWorkId=abcde
   ```
3. Students click the assignment link, sign in, complete the quiz, and submit.

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| `Firebase is not configured` | Paste your config into `js/firebase-config.js` |
| `Could not get Google Classroom access token` | Ensure `classroom.coursework.me` scope is added to the OAuth consent screen and the user re-consents |
| `Classroom API error 403` | Verify the user is enrolled in the course and the courseWorkId is correct |
| `Function returned an HTTP Error` | Check Cloud Function logs; ensure `classroom.googleapis.com` is enabled in the project |
| CORS / popup blocked | Ensure the app is served over HTTPS and the origin is in Firebase Auth authorized domains |

## 11. Files modified / created

- `js/firebase-config.js` — Firebase init, Google sign-in, Classroom scope
- `js/firebase-config.example.js` — committed template (git-ignored real file)
- `js/databaseManager.js` — Firestore sync for results, attempts, preferences
- `js/classroom.js` — Classroom submission button and callable Function call
- `js/results.js` — stores `correct`/`total` in state for submission payload
- `index.html` — loads Firebase SDKs, GIS client, sign-in/out buttons
- `functions/index.js` — callable `createClassroomSubmission`
- `firestore.rules` — security rules (or deploy via console)
