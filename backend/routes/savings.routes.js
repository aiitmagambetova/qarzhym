const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, n, plan } = require('../lib/util');
const { body, query, text, id, oneOf, date, amount } = require('../lib/validators');

const rules = [text('title', 150), text('description', 500, false), amount('target_amount'), date('target_date', { optional: true }),
  body('status').optional().isIn(['active', 'completed']).withMessage('Күй қате')];
const dec = (g) => ({ ...g, target_amount: n(g.target_amount), current_amount: n(g.current_amount), ...plan(g.target_amount, g.current_amount, g.target_date) });

async function owned(u, gid) {
  const g = await store.get(u, 'savings_goals', Number(gid));
  if (!g) throw new HttpError(404, 'Жинақ мақсаты табылмады');
  return g;
}

router.get('/', query('status').optional({ values: 'falsy' }).isIn(['active', 'completed']), query('sort').optional().isIn(['target_date', 'created']), wrap(async (req, res) => {
  check(req);
  const rows = (await store.list(req.session.userId, 'savings_goals')).filter((g) => !req.query.status || g.status === req.query.status);
  if (req.query.sort === 'target_date') rows.sort((a, b) => (a.target_date === null) - (b.target_date === null) || String(a.target_date).localeCompare(String(b.target_date)));
  else rows.sort((a, b) => b.id - a.id);
  ok(res, rows.map(dec));
}));
router.get('/:id', id, wrap(async (req, res) => { check(req); ok(res, dec(await owned(req.session.userId, req.params.id))); }));

router.post('/', rules, wrap(async (req, res) => {
  check(req); const b = req.body;
  ok(res, { id: await store.add(req.session.userId, 'savings_goals', { title: b.title, description: b.description || null, target_amount: Number(b.target_amount),
    current_amount: 0, target_date: b.target_date || null, status: 'active' }) }, 201);
}));
router.put('/:id', id, rules, wrap(async (req, res) => {
  check(req); const b = req.body; const g = await owned(req.session.userId, req.params.id);
  let status = b.status || g.status;
  if (status === 'active' && n(g.current_amount) >= Number(b.target_amount)) status = 'completed';
  await store.update(req.session.userId, 'savings_goals', g.id, { title: b.title, description: b.description || null, target_amount: Number(b.target_amount), target_date: b.target_date || null, status });
  ok(res, null);
}));
router.delete('/:id', id, wrap(async (req, res) => {
  check(req); const g = await owned(req.session.userId, req.params.id);
  await store.removeWhere(req.session.userId, 'savings_contributions', 'goal_id', g.id); // жарналар да жойылады
  await store.remove(req.session.userId, 'savings_goals', g.id);
  ok(res, null);
}));

router.get('/:id/contributions', id, wrap(async (req, res) => {
  check(req); const g = await owned(req.session.userId, req.params.id);
  const rows = await store.list(req.session.userId, 'savings_contributions', { where: ['goal_id', g.id] });
  ok(res, rows.sort((a, b) => b.id - a.id).map((r) => ({ ...r, amount: n(r.amount) })));
}));
// Жарна/алу: бір Firestore транзакциясында (қалдық + жазба). Бұл ШЫҒЫН ретінде саналмайды.
router.post('/:id/contributions', id, amount(), oneOf('type', ['deposit', 'withdrawal'], 'Түрі: салу немесе алу'), text('note', 255, false), wrap(async (req, res) => {
  check(req); const u = req.session.userId; const { amount: a, type, note } = req.body; const gid = Number(req.params.id);
  const out = await store.db.runTransaction(async (tx) => {
    const gref = store.ref(u, 'savings_goals', gid);
    const snap = await tx.get(gref);
    if (!snap.exists) throw new HttpError(404, 'Жинақ мақсаты табылмады');
    const g = snap.data();
    const cur = n(g.current_amount); const next = Math.round((type === 'deposit' ? cur + Number(a) : cur - Number(a)) * 100) / 100;
    if (next < 0) throw new HttpError(422, 'Жинақ сомасынан артық ақша алуға болмайды');
    const status = next >= n(g.target_amount) ? 'completed' : (g.status === 'completed' && type === 'withdrawal' ? 'active' : g.status);
    tx.create(store.ref(u, 'savings_contributions', store.newId()), { goal_id: gid, amount: Number(a), type, note: note || null, created_at: store.nowTs() });
    tx.update(gref, { current_amount: next, status });
    return { current_amount: next, status };
  });
  ok(res, out, 201);
}));
module.exports = router;
