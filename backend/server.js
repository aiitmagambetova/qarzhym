const app = require('./app');
const { db } = require('./config/firebase');

function hint(e) {
  const m = String(e.message || '');
  if (e.code === 5 || /does not exist|NOT_FOUND/i.test(m)) return 'Firestore дерекқоры жасалмаған. Firebase Console → Build → Firestore Database → «Create database» (Native mode).';
  if (e.code === 7 || /PERMISSION_DENIED|has not been used|disabled/i.test(m)) return 'Рұқсат жоқ: Cloud Firestore API өшірулі немесе кілт басқа жобаның. Firestore-ды Console-да жасаңыз және кілт сол жобаныкі екенін тексеріңіз.';
  if (/invalid_grant|private key|PEM|DECODER/i.test(m)) return 'Кілт жарамсыз. Firebase Console-дан жаңа private key жүктеп алыңыз.';
  return null;
}
async function waitForDb(retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try { await db.collection('_meta').doc('ping').get(); return; }
    catch (e) {
      const h = hint(e); if (h) throw new Error(`${h}\n(${e.message})`);
      console.log(`Firestore күтілуде (${i}/${retries}): ${e.message}`); await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Firestore-ға қосылу мүмкін болмады. Интернетті тексеріңіз.');
}
const port = Number(process.env.PORT) || 3000;
waitForDb().then(() => app.listen(port, () => console.log(`QARZHYM іске қосылды: http://localhost:${port}  (дерекқор: Firebase Firestore)`)))
  .catch((e) => { console.error('\n[FIREBASE] ' + e.message + '\n'); process.exit(1); });
