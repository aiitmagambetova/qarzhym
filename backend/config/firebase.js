// Firebase (Firestore) қосылымы. Кілт көздері (басымдық ретімен):
//  1) FIREBASE_SERVICE_ACCOUNT_JSON  (JSON немесе base64)
//  2) FIREBASE_KEY_FILE / GOOGLE_APPLICATION_CREDENTIALS  (файл жолы)
//  3) serviceAccountKey.json немесе *firebase-adminsdk*.json — жоба түбірінде немесе backend/ ішінде
//  4) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const admin = require('firebase-admin');

function findKeyFile() {
  const explicit = [process.env.FIREBASE_KEY_FILE, process.env.GOOGLE_APPLICATION_CREDENTIALS].filter(Boolean).map((f) => path.resolve(f));
  for (const f of explicit) if (fs.existsSync(f)) return f;
  for (const dir of [path.join(__dirname, '..', '..'), path.join(__dirname, '..')]) {
    const fixed = path.join(dir, 'serviceAccountKey.json');
    if (fs.existsSync(fixed)) return fixed;
    let names = [];
    try { names = fs.readdirSync(dir); } catch { /* қалта жоқ */ }
    const hit = names.find((x) => /firebase-adminsdk.*\.json$/i.test(x));
    if (hit) return path.join(dir, hit);
  }
  return null;
}

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    try { return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf8')); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON оқылмады: дұрыс JSON (немесе base64) емес.'); }
  }
  const file = findKeyFile();
  if (file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { throw new Error(`Кілт файлы оқылмады (${file}): дұрыс JSON емес.`); }
  }
  const { FIREBASE_PROJECT_ID: project_id, FIREBASE_CLIENT_EMAIL: client_email, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (project_id && client_email && key) return { project_id, client_email, private_key: key.replace(/\\n/g, '\n') };
  return null;
}

try {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-qarzhym' });
  } else {
    const cred = loadCredential();
    if (!cred) {
      throw new Error('Firebase кілті табылмады.\n'
        + '  → Firebase Console → Project settings → Service accounts → «Generate new private key».\n'
        + '  → Жүктелген JSON файлды жоба түбіне serviceAccountKey.json деп қойыңыз (docker-compose.yml жанына).\n'
        + '  Толық нұсқаулық: FIREBASE_SETUP.md');
    }
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
} catch (e) {
  console.error('\n[FIREBASE] ' + e.message + '\n');
  process.exit(1);
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
module.exports = { admin, db };
