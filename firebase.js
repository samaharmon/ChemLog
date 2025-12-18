// firebaseInit.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  deleteDoc
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

// Firestore collection name: 'pools'
const poolsCollectionRef = () => collection(db, 'pools');

export async function getPools() {
  try {
    const snapshot = await getDocs(poolsCollectionRef());
    const pools = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    console.log('Pools fetched:', pools);
    return pools;
  } catch (error) {
    console.error('Error fetching pools:', error);
    return [];
  }
}

export function listenPools(callback) {
  try {
    const unsubscribe = onSnapshot(poolsCollectionRef(), snapshot => {
      const pools = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      console.log('Pools updated:', pools);
      callback(pools);
    });
    return unsubscribe;
  } catch (error) {
    console.error('Error listening to pools:', error);
    return () => {};
  }
}

export async function savePool(poolIdOrNull, poolData) {
  try {
    if (!poolIdOrNull) {
      const docRef = await addDoc(poolsCollectionRef(), poolData);
      console.log('Pool added with ID:', docRef.id);
      return docRef.id;
    }

    await setDoc(doc(poolsCollectionRef(), poolIdOrNull), poolData);
    console.log('Pool saved with ID:', poolIdOrNull);
    return poolIdOrNull;
  } catch (error) {
    console.error('Error saving pool:', error);
    return null;
  }
}

export async function savePoolDoc(poolIdOrNull, poolData) {
  return savePool(poolIdOrNull, poolData);
}

export async function deletePool(poolId) {
  try {
    await deleteDoc(doc(poolsCollectionRef(), poolId));
    console.log('Pool deleted with ID:', poolId);
    return true;
  } catch (error) {
    console.error('Error deleting pool:', error);
    return false;
  }
}

export async function deletePoolDoc(poolId) {
  return deletePool(poolId);
}

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
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
};
