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
