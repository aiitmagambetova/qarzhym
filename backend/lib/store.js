// Firestore қабаты. Құрылым:  users/{userId}/{collection}/{numericId}
//  - Әр пайдаланушының деректері өз ішкі коллекцияларында → басқа пайдаланушы деректеріне қол жеткізу мүмкін емес.
//  - ID — сан (frontend өзгеріссіз жұмыс істейді), уақыт бойынша өседі.
//  - Құрама индекс (composite index) қажет болмау үшін Firestore-ға тек бір өрісті сүзгі беріледі, қалғаны жадта сүзіледі.
const crypto = require('crypto');
const { db } = require('../config/firebase');

const DEFAULT_SETTINGS = { theme: 'dark', date_format: 'long', notify_budget: 1, notify_payments: 1, notify_goals: 1, starting_balance: 0 };
const ALREADY_EXISTS = 6; const NOT_FOUND = 5;

let last = 0;
const newId = () => { last = Math.max(last + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)); return last; };
const p2 = (x) => String(x).padStart(2, '0');
const nowTs = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };

const userRef = (uid) => db.collection('users').doc(String(uid));
const col = (uid, name) => userRef(uid).collection(name);
const ref = (uid, name, id) => col(uid, name).doc(String(id));
const emailRef = (email) => db.collection('emails').doc(crypto.createHash('sha256').update(String(email)).digest('hex'));
const toObj = (d) => ({ id: Number(d.id), ...d.data() });

// opts: { field, from, to }  — диапазон ЖЕКЕ ӨРІСКЕ;  { where: [field, value] } — теңдік. Екеуін қоспаңыз (индекс қажет болады).
async function list(uid, name, opts = {}) {
  let q = col(uid, name);
  if (opts.field) {
    if (opts.from != null) q = q.where(opts.field, '>=', opts.from);
    if (opts.to != null) q = q.where(opts.field, '<=', opts.to);
  }
  if (opts.where) q = q.where(opts.where[0], '==', opts.where[1]);
  const snap = await q.get();
  return snap.docs.map(toObj);
}
async function get(uid, name, id) {
  const s = await ref(uid, name, id).get();
  return s.exists ? toObj(s) : null;
}
async function add(uid, name, data) {
  for (let i = 0; i < 5; i++) {
    const id = newId();
    try { await ref(uid, name, id).create({ ...data, created_at: data.created_at || nowTs() }); return id; }
    catch (e) { if (e.code !== ALREADY_EXISTS) throw e; }
  }
  throw new Error('ID жасау мүмкін болмады');
}
async function update(uid, name, id, data) {
  try { await ref(uid, name, id).update(data); return true; }
  catch (e) { if (e.code === NOT_FOUND) return false; throw e; }
}
async function remove(uid, name, id) {
  const r = ref(uid, name, id); const s = await r.get();
  if (!s.exists) return false;
  await r.delete(); return true;
}
async function removeWhere(uid, name, field, value) {
  const snap = await col(uid, name).where(field, '==', value).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = db.batch(); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
  }
}

// ---- Пайдаланушылар ----
async function createUser({ full_name, email, password_hash, categories }) {
  const uid = newId(); const created_at = nowTs(); const b = db.batch();
  b.create(emailRef(email), { user_id: uid }); // email бірегейлігі: құжат бар болса бүкіл batch құлайды
  b.create(userRef(uid), { full_name, email, password_hash, created_at, settings: { ...DEFAULT_SETTINGS } });
  categories.forEach((c) => b.create(ref(uid, 'categories', newId()), { ...c, created_at }));
  try { await b.commit(); } catch (e) { if (e.code === ALREADY_EXISTS) return null; throw e; }
  return uid;
}
async function getUser(uid) {
  const s = await userRef(uid).get();
  if (!s.exists) return null;
  const d = s.data();
  return { id: Number(s.id), ...d, settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}), starting_balance: Number((d.settings || {}).starting_balance || 0) } };
}
async function findUserByEmail(email) {
  const e = await emailRef(email).get();
  return e.exists ? getUser(e.data().user_id) : null;
}
const updateUser = (uid, data) => userRef(uid).update(data);

module.exports = { db, DEFAULT_SETTINGS, newId, nowTs, ref, col, list, get, add, update, remove, removeWhere, createUser, getUser, findUserByEmail, updateUser };
