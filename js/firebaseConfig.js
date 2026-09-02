/**
 * Firebase Configuration & Auth
 * Replace the placeholder values below with your actual Firebase config.
 */

window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

if (!window.firebaseApp && typeof firebase !== 'undefined' && window.FIREBASE_CONFIG.apiKey && !window.FIREBASE_CONFIG.apiKey.startsWith('YOUR_')) {
  try {
    window.firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
    window.firebaseAuth = firebase.auth();
    window.firebaseDb = firebase.firestore();
    console.log('Firebase initialized successfully (App, Auth, Firestore)');
  } catch (error) {
    console.warn('Firebase initialization failed:', error.message);
  }
}

if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth.GoogleAuthProvider) {
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.addScope('https://www.googleapis.com/auth/classroom.coursework.me');

  window.signInWithGoogle = async function () {
    if (!window.firebaseAuth) {
      alert('Firebase is not configured.');
      return null;
    }
    try {
      const result = await window.firebaseAuth.signInWithPopup(googleProvider);
      const user = result.user;
      console.log('Google sign-in successful:', user.displayName);
      return user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };
} else {
  window.signInWithGoogle = async function () {
    alert('Firebase SDK not loaded. Check your internet connection or ad blocker.');
    return null;
  };
}

window.signOut = async function () {
  if (!window.firebaseAuth) return;
  try {
    await window.firebaseAuth.signOut();
    console.log('Signed out successfully');
  } catch (error) {
    console.error('Sign out error:', error);
  }
};

window.getCurrentFirebaseUser = function () {
  return window.firebaseAuth ? window.firebaseAuth.currentUser : null;
};

window.getFreshClassroomAccessToken = async function () {
  var gisToken = localStorage.getItem('google_access_token');
  var gisExpiry = localStorage.getItem('google_token_expiry');
  if (gisToken && gisExpiry && Date.now() < parseInt(gisExpiry, 10)) {
    return gisToken;
  }
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_expiry');
  const user = window.getCurrentFirebaseUser();
  if (!user) return null;
  try {
    const result = await user.getIdTokenResult();
    const accessToken = result.signInAttributes?.access_token;
    if (accessToken) return accessToken;
  } catch (e) {
    console.warn('Failed to get cached classroom access token:', e);
  }
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth.GoogleAuthProvider) {
    try {
      const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(user);
      if (credential && credential.accessToken) {
        return credential.accessToken;
      }
    } catch (e) {
      console.warn('Failed to get fresh access token:', e);
    }
  }
  return null;
};

  /* ── Check for GIS token from login.html ── */
  function checkGisToken() {
    var gisToken = localStorage.getItem('google_access_token');
    var gisExpiry = localStorage.getItem('google_token_expiry');
    if (gisToken && gisExpiry && Date.now() < parseInt(gisExpiry, 10)) {
      if (app && app.state) {
        app.state.user = { uid: 'gis-user', email: null, displayName: null, photoURL: null };
      }
      var signInBtn = document.getElementById('signInBtn');
      var signOutBtn = document.getElementById('signOutBtn');
      if (signInBtn) signInBtn.classList.add('hidden');
      if (signOutBtn) signOutBtn.classList.remove('hidden');
      return true;
    }
    return false;
  }

  function saveUserDoc(user) {
    if (!window.firebaseDb || !user) return;
    window.firebaseDb.collection('users').doc(user.uid).set({
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function (e) {
      console.warn('Failed to save user doc:', e.message);
    });
  }

  if (window.firebaseAuth) {
  window.firebaseAuth.onAuthStateChanged(function (user) {
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    if (user && app && app.state) {
      app.state.user = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };
      console.log('Auth state changed: signed in as', user.email);
      saveUserDoc(user);
      if (signInBtn) signInBtn.classList.add('hidden');
      if (signOutBtn) signOutBtn.classList.remove('hidden');
    } else if (app && app.state) {
      app.state.user = null;
      console.log('Auth state changed: signed out');
      if (!checkGisToken()) {
        if (signInBtn) signInBtn.classList.remove('hidden');
        if (signOutBtn) signOutBtn.classList.add('hidden');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  checkGisToken();

  document.getElementById('signInBtn')?.addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      try {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        if (typeof window.signOut === 'function') await window.signOut();
        if (app && app.state) app.state.user = null;
        document.getElementById('signInBtn')?.classList.remove('hidden');
        signOutBtn.classList.add('hidden');
      } catch (e) {
        console.error('Sign out error:', e);
      }
    });
  }
});
