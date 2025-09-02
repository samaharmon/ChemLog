// firebaseInit.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyCRxSL2uuH6O5MFvbq0FS02zF2K_lXGvqI",
  authDomain: "chemlog-43c08.firebaseapp.com",
  projectId: "chemlog-43c08",
  storageBucket: "chemlog-43c08.firebasestorage.app",
  messagingSenderId: "554394202059",
  appId: "1:554394202059:web:a8d5824a1d7ccdd871d04e",
  measurementId: "G-QF5ZQ88VS2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export initialized modules
export {
  app,
  db,
  auth,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
};
