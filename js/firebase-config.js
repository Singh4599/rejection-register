// firebase-config.js — LV Spices Rejection Register
// Project: rejection-84120 | Collection: rejection_records

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2rrUEpxplENuBTZfo70MGK7oc31wHaew",
  authDomain: "employees-84985.firebaseapp.com",
  projectId: "employees-84985",
  storageBucket: "employees-84985.firebasestorage.app",
  messagingSenderId: "1064706743708",
  appId: "1:1064706743708:web:b2a58b31272d3c5521bc59"
};

const COLLECTION = "rejection_records";
let db = null;

export function updateCloudBadge(connected) {
  const badge = document.getElementById('cloud-status-badge');
  const text  = document.getElementById('cloud-status-text');
  if (!badge) return;
  if (connected) {
    badge.className = 'cloud-status-pill connected';
    if (text) text.textContent = 'Cloud Synced (Firestore)';
  } else {
    badge.className = 'cloud-status-pill offline';
    if (text) text.textContent = 'Offline Mode';
  }
}

export function initFirebase() {
  if (db) return db;
  try {
    const app = getApps().find(a => a.name === 'rejection') || initializeApp(firebaseConfig, 'rejection');
    db = getFirestore(app);
    updateCloudBadge(true);
    return db;
  } catch (err) {
    console.warn('[Firebase RR] Init error:', err);
    updateCloudBadge(false);
    return null;
  }
}

export async function saveEntryToCloud(entry) {
  const database = initFirebase();
  if (!database) return false;
  try {
    await setDoc(doc(database, COLLECTION, entry.id), { ...entry, updatedAt: Date.now() }, { merge: true });
    updateCloudBadge(true);
    return true;
  } catch (err) {
    console.error('[Firebase RR] Save error:', err);
    updateCloudBadge(false);
    return false;
  }
}

export async function deleteEntryFromCloud(id) {
  const database = initFirebase();
  if (!database) return false;
  try {
    await deleteDoc(doc(database, COLLECTION, id));
    return true;
  } catch (err) {
    console.error('[Firebase RR] Delete error:', err);
    return false;
  }
}

export async function loadAllEntriesFromCloud() {
  const database = initFirebase();
  if (!database) return [];
  try {
    const q = query(collection(database, COLLECTION), orderBy("date", "desc"), limit(500));
    const snap = await getDocs(q);
    const entries = [];
    snap.forEach(d => entries.push(d.data()));
    updateCloudBadge(true);
    return entries;
  } catch (err) {
    console.warn('[Firebase RR] Load error:', err);
    updateCloudBadge(false);
    return [];
  }
}

try { initFirebase(); } catch(e) {}
