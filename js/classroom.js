/**
 * classroom.js - Google Classroom submission integration
 *
 * Reads courseId/courseWorkId from URL, renders Submit button on results,
 * and calls a callable Cloud Function to create a draft submission.
 */

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const classroomCourseId = params.get('courseId');
  const classroomCourseWorkId = params.get('courseWorkId');
  let submitting = false;

  function isClassroomDestination() {
    return !!(classroomCourseId && classroomCourseWorkId);
  }

  function getUser() {
    return window.getCurrentFirebaseUser ? window.getCurrentFirebaseUser() : null;
  }

  async function submitToClassroom() {
    const user = getUser();
    if (!user || !isClassroomDestination() || submitting) return;
    submitting = true;

    const accessToken = await window.getFreshClassroomAccessToken();
    if (!accessToken) {
      alert('Could not get Google Classroom access token. Please sign in again.');
      submitting = false;
      return;
    }

    const attemptId = app.state.section + '|' + app.state.level + '|' + Date.now();
    const attemptData = {
      section: app.state.section,
      level: app.state.level,
      variant: app.state.quizVariant,
      correct: app.state.correct || 0,
      total: app.state.total || 0,
      pct: app.state.score || 0,
      passed: app.state.passed || false,
      answers: app.state.answers || {},
      date: new Date().toISOString()
    };

    if (window.databaseManager && window.databaseManager.saveAttemptToFirestore) {
      await window.databaseManager.saveAttemptToFirestore(user.uid, attemptId, attemptData);
    }

    const idToken = await user.getIdToken();
    const payload = {
      idToken,
      classroomAccessToken: accessToken,
      courseId: classroomCourseId,
      courseWorkId: classroomCourseWorkId,
      attemptId,
      scoreLine: `${attemptData.pct}% on ${app.sectionTitle ? app.sectionTitle() : app.state.section}`
    };

    try {
      const fn = window.firebaseApp.functions('us-central1');
      const result = await fn.httpsCallable('createClassroomSubmission')(payload);
      console.log('Classroom submission created:', result.data);
      alert('Submitted to Google Classroom successfully!');
    } catch (error) {
      console.error('Classroom submission failed:', error);
      alert('Failed to submit to Google Classroom: ' + (error.message || 'Unknown error'));
    } finally {
      submitting = false;
    }
  }

  function renderSubmitButton(wrap) {
    if (!isClassroomDestination() || !getUser()) return;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Submit to Classroom';
    btn.addEventListener('click', submitToClassroom);
    wrap.appendChild(btn);
  }

  function patchApp() {
    if (!window.app || !window.app.showResults) return;
    const originalShowResults = window.app.showResults;
    window.app.showResults = function () {
      originalShowResults();
      const wrap = window.app.el.resultsContainer.querySelector('.results-actions');
      if (wrap) {
        renderSubmitButton(wrap);
      }
    };
  }

  if (window.app && window.app.showResults) {
    patchApp();
  } else {
    document.addEventListener('DOMContentLoaded', patchApp);
  }

})();
