/**
 * Firebase Configuration
 * This file initializes Firebase using config from config.js
 */

// Firebase is initialized using appFirebaseConfig from config.js
// Expose on window for cross-script access
window.firebaseApp = null;
window.firebaseAuth = null;
window.firebaseDb = null;

// Check if Firebase is configured (config.js must be loaded first)
if (typeof appFirebaseConfig !== 'undefined' && appFirebaseConfig.apiKey && !appFirebaseConfig.apiKey.startsWith('YOUR_')) {
    try {
        window.firebaseApp = firebase.initializeApp(appFirebaseConfig);
        window.firebaseAuth = firebase.auth();
        window.firebaseDb = firebase.firestore();
        console.log('Firebase initialized successfully (App, Auth, Firestore)');
    } catch (error) {
        console.warn('Firebase initialization failed:', error.message);
    }
} else {
    console.warn('Firebase not configured. Please add your Firebase config to js/config.js');
}

// Google Auth Provider - initialize only if firebaseAuth exists
let googleProvider = null;
if (typeof firebase !== 'undefined' && window.firebaseAuth) {
    googleProvider = new firebase.auth.GoogleAuthProvider();
}

// Sign in with Google
async function signInWithGoogle() {
    if (!window.firebaseAuth) {
        alert('Firebase is not configured. Please add your Firebase config to js/config.js');
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
}

// Sign out
async function signOut() {
    if (!window.firebaseAuth) return;
    
    try {
        await window.firebaseAuth.signOut();
        console.log('Signed out successfully');
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// Get current user
function getCurrentFirebaseUser() {
    return window.firebaseAuth ? window.firebaseAuth.currentUser : null;
}

// Export for use in other scripts (do not redeclare isFirebaseConfigured)
// Use config.js's isFirebaseConfigured() which now checks window.firebaseAuth
