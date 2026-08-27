/**
 * DatabaseManager.js - Firestore sync for quiz results, preferences, and attempts
 */

class DatabaseManager {
  constructor(app) {
    this.app = app;
    this.syncing = false;
  }

  isFirebaseConfigured() {
    return !!window.firebaseDb;
  }

  getCurrentUser() {
    return window.getCurrentFirebaseUser ? window.getCurrentFirebaseUser() : null;
  }

  getUserDocPath(uid, path) {
    return `users/${uid}/${path}`;
  }

  async saveQuizResultToFirestore(uid, section, level, result) {
    if (!this.isFirebaseConfigured() || !uid) return;
    const docRef = window.firebaseDb.collection(this.getUserDocPath(uid, 'results')).doc(`${section}|${level}`);
    await docRef.set({
      attempts: firebase.firestore.FieldValue.increment(1),
      bestPct: firebase.firestore.FieldValue.max(result.bestPct || 0),
      passed: (result.bestPct || 0) >= 80,
      lastVariant: result.lastVariant,
      history: firebase.firestore.FieldValue.arrayUnion(result.historyEntry),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async saveAttemptToFirestore(uid, attemptId, attemptData) {
    if (!this.isFirebaseConfigured() || !uid) return;
    await window.firebaseDb.collection(this.getUserDocPath(uid, 'attempts')).doc(attemptId).set({
      ...attemptData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async savePreferencesToFirestore(uid, prefs) {
    if (!this.isFirebaseConfigured() || !uid) return;
    await window.firebaseDb.collection(this.getUserDocPath(uid, 'preferences')).doc('settings').set({
      ...prefs,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async loadUserData(uid) {
    if (!this.isFirebaseConfigured() || !uid) return null;
    const [resultsSnap, prefsSnap] = await Promise.all([
      window.firebaseDb.collection(this.getUserDocPath(uid, 'results')).get(),
      window.firebaseDb.collection(this.getUserDocPath(uid, 'preferences')).doc('settings').get()
    ]);
    const results = {};
    resultsSnap.forEach(doc => {
      results[doc.id] = doc.data();
    });
    return {
      results,
      preferences: prefsSnap.exists ? prefsSnap.data() : null
    };
  }

  async syncToFirestore() {
    if (this.syncing) return;
    this.syncing = true;
    const user = this.getCurrentUser();
    if (!user) {
      this.syncing = false;
      return;
    }
    try {
      const results = this.app.getResults ? this.app.getResults() : {};
      const syncPromises = [];
      Object.keys(results).forEach(key => {
        const entry = results[key];
        const historyEntry = entry.history && entry.history.length > 0
          ? entry.history[entry.history.length - 1]
          : { variant: entry.lastVariant, pct: entry.bestPct, correct: 0, total: 0, date: new Date().toISOString() };
        syncPromises.push(
          this.saveQuizResultToFirestore(user.uid, key.split('|')[0], key.split('|')[1], {
            bestPct: entry.bestPct,
            lastVariant: entry.lastVariant,
            historyEntry
          })
        );
      });
      await Promise.all(syncPromises);
      console.log('Synced quiz results to Firestore');
    } catch (error) {
      console.error('Firestore sync error:', error);
    } finally {
      this.syncing = false;
    }
  }

  async hydrateFromFirestore() {
    const user = this.getCurrentUser();
    if (!user || !this.isFirebaseConfigured()) return;
    try {
      const data = await this.loadUserData(user.uid);
      if (!data) return;
      if (data.preferences && this.app.applyPreferences) {
        this.app.applyPreferences(data.preferences);
      }
      if (data.results && this.app.mergeResults) {
        this.app.mergeResults(data.results);
      }
    } catch (error) {
      console.error('Hydration error:', error);
    }
  }
}

function initDatabaseManager() {
  if (!window.app) return;
  window.databaseManager = new DatabaseManager(window.app);

  const user = window.databaseManager.getCurrentUser();
  if (user) {
    window.databaseManager.hydrateFromFirestore();
  }
}

if (window.app && window.app.getResults) {
  initDatabaseManager();
} else {
  document.addEventListener('DOMContentLoaded', initDatabaseManager);
}
