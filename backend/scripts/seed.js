// Демо деректер (міндетті емес):  cd backend && npm run seed
// Алдымен сайтта тіркеліңіз. Деректер ең бірінші тіркелген пайдаланушыға қосылады.
const { db } = require('../config/firebase');
const store = require('../lib/store');
const { today, monthRange, addMonths } = require('../lib/util');

(async () => {
  const snap = await db.collection('users').get();
  if (snap.empty) { console.log('Пайдаланушы жоқ. Алдымен сайтта тіркеліңіз.'); return; }
  const first = snap.docs.map((d) => Number(d.id)).sort((a, b) => a - b)[0];
  const cats = await store.list(first, 'categories');
  const cat = (type, name) => (cats.find((c) => c.type === type && c.name === name) || {}).id;
  const t = today(); const [from, to] = monthRange(t.slice(0, 7));
  const tx = (title, amount, type, category, date) => store.add(first, 'transactions', { title, amount, type, category_id: category, tx_date: date, description: null, payment_method: 'Карта', notes: null });
  await tx('[ДЕМО] Айлық жалақы', 280000, 'income', cat('income', 'Жалақы'), from);
  await tx('[ДЕМО] Азық-түлік дүкені', 18500, 'expense', cat('expense', 'Азық-түлік'), t);
  await tx('[ДЕМО] Интернет', 6000, 'expense', cat('expense', 'Байланыс және интернет'), t);
  await store.add(first, 'budgets', { name: '[ДЕМО] Азық-түлік бюджеті', category_id: cat('expense', 'Азық-түлік'), amount: 60000, period: 'monthly', start_date: from, end_date: to });
  await store.add(first, 'savings_goals', { title: '[ДЕМО] Ноутбук сатып алу', description: null, target_amount: 400000, current_amount: 160000, target_date: addMonths(t, 6), status: 'active' });
  console.log('Демо деректер қосылды (пайдаланушы ID: ' + first + ').');
})().catch((e) => { console.error(e.message); process.exit(1); }).then(() => process.exit());
