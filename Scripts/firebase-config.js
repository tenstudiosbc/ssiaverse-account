// SSIAVerse Firebase Configuration
// This file contains your Firebase project settings.
// For GitHub Pages: Place this in the same directory as index.html
// NOTE: Firebase API keys are NOT secret - they are safe to expose in client-side code.
// Security is enforced by Firebase Security Rules, not by hiding the API key.
// See: https://firebase.google.com/docs/projects/api-keys

const firebaseConfig = {
  apiKey: "AIzaSyD3LpTve-8c97k2yvS54nNY-gkNQF5S9u4",
  authDomain: "ssiavc.firebaseapp.com",
  projectId: "ssiavc",
  storageBucket: "ssiavc.firebasestorage.app",
  messagingSenderId: "96237914866",
  appId: "1:96237914866:web:173eb41dc235b28cde5e6b",
  measurementId: "G-ZQ22N7REDR"
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}
