import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const SEED_FILE = path.resolve(__dirname, '../../data/hcm_store.json');
const DATA_DIR = isVercel ? '/tmp' : path.resolve(__dirname, '../../data');
const DB_FILE = isVercel ? path.join('/tmp', 'hcm_store.json') : SEED_FILE;

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  // Gracefully ignore on read-only environments
}

const DEFAULT_STORE = {
  company: null,
  users: [],
  departments: [],
  designations: [],
  leaveTypes: [],
  holidays: [],
  employees: [],
  attendance: [],
  leaveRequests: [],
  payrollRuns: [],
  payslips: [],
  announcements: [],
  notifications: [],
  auditLogs: [],
  aiLogs: [],
};
const ARRAY_COLLECTIONS = Object.keys(DEFAULT_STORE).filter(key => Array.isArray(DEFAULT_STORE[key]));
let memoryStore = null;
let firestoreDb = null;
let remoteSnapshot = null;
let remoteQueue = Promise.resolve();

const clone = value => JSON.parse(JSON.stringify(value));

function readLocalStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    if (isVercel && fs.existsSync(SEED_FILE)) {
      const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
      } catch (err) {}
      return seed;
    }
    return clone(DEFAULT_STORE);
  } catch (err) {
    console.warn('Fallback to default store on read failure:', err.message);
    return clone(DEFAULT_STORE);
  }
}

function writeLocalStore(store) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.warn('Local persistence write fallback to memory:', err.message);
  }
}

/**
 * Optional Firestore system-of-record adapter. Configure FIREBASE_SERVICE_ACCOUNT_JSON
 * (service-account JSON in a secret environment variable) or GOOGLE_APPLICATION_CREDENTIALS
 * (path to a service-account file) on the server. The browser's Firebase config is public
 * and cannot authenticate privileged backend database access.
 *
 * Arrays are stored as individual documents in collections to avoid a single-document size
 * ceiling. Writes are diffed and serialized; API responses can await flushStore().
 */
export async function initializeStore() {
  memoryStore = readLocalStore();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountJson && !credentialsPath) return memoryStore;

  let appModule;
  let firestoreModule;
  try {
    appModule = await import('firebase-admin/app');
    firestoreModule = await import('firebase-admin/firestore');
  } catch (err) {
    throw new Error(`Firestore credentials are configured but firebase-admin is unavailable: ${err.message}`);
  }

  let credential;
  if (serviceAccountJson) {
    try {
      credential = appModule.cert(JSON.parse(serviceAccountJson));
    } catch (err) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid service-account JSON: ${err.message}`);
    }
  } else {
    credential = appModule.applicationDefault();
  }

  const appName = 'hcm-lite-server';
  const existingApp = appModule.getApps().find(app => app.name === appName);
  const adminApp = existingApp || appModule.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  }, appName);
  firestoreDb = firestoreModule.getFirestore(adminApp);

  const metaRef = firestoreDb.collection('hcmLiteMeta').doc('state');
  const meta = await metaRef.get();
  if (meta.exists && meta.data()?.initialized === true) {
    const remote = clone(DEFAULT_STORE);
    const companyDoc = await firestoreDb.collection('hcmLiteMeta').doc('company').get();
    remote.company = companyDoc.exists ? companyDoc.data()?.value ?? null : null;
    for (const collectionName of ARRAY_COLLECTIONS) {
      const snap = await firestoreDb.collection(`hcmLite_${collectionName}`).get();
      remote[collectionName] = snap.docs
        .map(doc => {
          const { __hcmOrder = 0, ...record } = doc.data();
          return { order: __hcmOrder, record };
        })
        .sort((a, b) => a.order - b.order)
        .map(item => item.record);
    }
    memoryStore = remote;
    remoteSnapshot = clone(remote);
    writeLocalStore(remote);
  } else {
    // First Firestore startup migrates the existing local store instead of discarding data.
    remoteSnapshot = clone(DEFAULT_STORE);
    await persistSnapshot(memoryStore);
  }
  return memoryStore;
}

export function loadStore(forceReload = false) {
  if (memoryStore && !forceReload) return memoryStore;
  memoryStore = readLocalStore();
  return memoryStore;
}

async function persistSnapshot(snapshot) {
  if (!firestoreDb) return;
  const batchOperations = [];
  const addSet = (ref, data) => batchOperations.push({ type: 'set', ref, data });
  const addDelete = ref => batchOperations.push({ type: 'delete', ref });

  const companyRef = firestoreDb.collection('hcmLiteMeta').doc('company');
  if (JSON.stringify(snapshot.company) !== JSON.stringify(remoteSnapshot?.company)) {
    if (snapshot.company === null) addDelete(companyRef);
    else addSet(companyRef, { value: snapshot.company });
  }

  for (const collectionName of ARRAY_COLLECTIONS) {
    const collection = firestoreDb.collection(`hcmLite_${collectionName}`);
    const before = new Map((remoteSnapshot?.[collectionName] || []).filter(row => row?.id).map((row, index) => [row.id, { row, index }]));
    const afterRows = snapshot[collectionName] || [];
    const afterIds = new Set();
    afterRows.forEach((row, index) => {
      if (!row?.id) throw new Error(`Firestore persistence requires an id for ${collectionName} record at index ${index}.`);
      afterIds.add(row.id);
      const previous = before.get(row.id);
      if (!previous || previous.index !== index || JSON.stringify(previous.row) !== JSON.stringify(row)) {
        addSet(collection.doc(String(row.id)), { ...row, __hcmOrder: index });
      }
    });
    for (const [id] of before) if (!afterIds.has(id)) addDelete(collection.doc(String(id)));
  }

  // Firestore batches are capped at 500 writes. Chunking supports bulk import/migration;
  // normal individual requests typically touch only a small number of documents.
  for (let offset = 0; offset < batchOperations.length; offset += 450) {
    const batch = firestoreDb.batch();
    for (const operation of batchOperations.slice(offset, offset + 450)) {
      if (operation.type === 'set') batch.set(operation.ref, operation.data);
      else batch.delete(operation.ref);
    }
    await batch.commit();
  }
  await firestoreDb.collection('hcmLiteMeta').doc('state').set({ initialized: true, updatedAt: new Date().toISOString() });
  remoteSnapshot = clone(snapshot);
}

export function saveStore(newStore) {
  memoryStore = newStore;
  writeLocalStore(memoryStore);
  if (firestoreDb) {
    const snapshot = clone(newStore);
    remoteQueue = remoteQueue.catch(() => {}).then(() => persistSnapshot(snapshot));
  }
}

/** Wait for remote Firestore persistence, if configured, before returning a successful API response. */
export async function flushStore() {
  await remoteQueue;
}

export function resetStore() {
  memoryStore = clone(DEFAULT_STORE);
  saveStore(memoryStore);
  return memoryStore;
}
