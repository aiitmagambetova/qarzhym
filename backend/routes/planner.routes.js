const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, n, plan, today, addDays, monthRange } = require('../lib/util');
const { body, query, text, id, oneOf, date, amount } = require('../lib/validators');
const stats = require('../lib/stats');

const goalRules = [text('title', 150), text('description', 500, false), amount('target_amount'), date('target_date', { optional: true }),
  body('current_amount').optional({ values: 'falsy' }).custom((v) => /^\d+(\.\d{1,2})?$/.test(String(v)) && Number(v) <= 1e10).withMessage('Жиналған сома дұрыс емес')];
const ptRules = [text('title', 150), amount(), oneOf('type', ['income', 'expense'], 'Түрі: кіріс немесе шығыс'), date('planned_date'),
  body('category_id').optional({ values: 'falsy' }).isInt({ min: 1 }), body('status').optional().isIn(['planned', 'done', 'cancelled']).withMessage('Күй қате')];
const dg = (g) => ({ ...g, target_amount: n(g.target_amount), current_amount: n(g.current_amount), ...plan(g.target_amount, g.current_amount, g.target_date) });
const goalData = (b) => ({ title: b.title, description: b.description || null, target_amount: Number(b.target_amount), current_amount: Number(b.current_amount || 0), target_date: b.target_date || null });

router.get('/goals', wrap(async (req, res) => {
  const rows = await store.list(req.session.userId, 'financial_goals');
  rows.sort((a, b) => (a.target_date === null) - (b.target_date === null) || String(a.target_date).localeCompare(String(b.target_date)) || a.id - b.id);
  ok(res, rows.map(dg));
}));
router.post('/goals', goalRules, wrap(async (req, res) => {
  check(req);
  ok(res, { id: await store.add(req.session.userId, 'financial_goals', goalData(req.body)) }, 201);
}));
router.put('/goals/:id', id, goalRules, wrap(async (req, res) => {
  check(req);
  if (!(await store.update(req.session.userId, 'financial_goals', Number(req.params.id), goalData(req.body)))) throw new HttpError(404, 'Мақсат табылмады');
  ok(res, null);
}));
router.delete('/goals/:id', id, wrap(async (req, res) => {
  check(req);
  if (!(await store.remove(req.session.userId, 'financial_goals', Number(req.params.id)))) throw new HttpError(404, 'Мақсат табылмады');
  ok(res, null);
}));

async function checkCat(u, cid, type) {
  if (!cid) return;
  const c = await store.get(u, 'categories', Number(cid));
  if (!c || c.type !== type) throw new HttpError(422, 'Санат табылмады немесе түрі сәйкес емес');
}
const ptData = (b) => ({ category_id: b.category_id ? Number(b.category_id) : null, title: b.title, amount: Number(b.amount), type: b.type, planned_date: b.planned_date, status: b.status || 'planned' });
const mapAmt = (r) => ({ ...r, amount: n(r.amount) });

router.get('/transactions', query('status').optional({ values: 'falsy' }).isIn(['planned', 'done', 'cancelled']), wrap(async (req, res) => {
  check(req); const u = req.session.userId;
  const [rows, cats] = await Promise.all([store.list(u, 'planned_transactions'), store.list(u, 'categories')]);
  const byId = new Map(cats.map((c) => [c.id, c]));
  ok(res, rows.filter((r) => !req.query.status || r.status === req.query.status)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.id - b.id)
    .map((r) => ({ ...mapAmt(r), category_name: (byId.get(r.category_id) || {}).name || null })));
}));
router.post('/transactions', ptRules, wrap(async (req, res) => {
  check(req); const b = req.body; await checkCat(req.session.userId, b.category_id, b.type);
  ok(res, { id: await store.add(req.session.userId, 'planned_transactions', ptData(b)) }, 201);
}));
router.put('/transactions/:id', id, ptRules, wrap(async (req, res) => {
  check(req); const b = req.body; await checkCat(req.session.userId, b.category_id, b.type);
  if (!(await store.update(req.session.userId, 'planned_transactions', Number(req.params.id), ptData(b)))) throw new HttpError(404, 'Жоспар табылмады');
  ok(res, null);
}));
router.delete('/transactions/:id', id, wrap(async (req, res) => {
  check(req);
  if (!(await store.remove(req.session.userId, 'planned_transactions', Number(req.params.id)))) throw new HttpError(404, 'Жоспар табылмады');
  ok(res, null);
}));

// Алдағы/мерзімі өткен төлемдер және осы айдағы жоспар мен нақты салыстыру
router.get('/overview', wrap(async (req, res) => {
  const u = req.session.userId; const t = today(); const [from, to] = monthRange(t.slice(0, 7));
  const all = await store.list(u, 'planned_transactions');
  const byDate = (a, b) => a.planned_date.localeCompare(b.planned_date) || a.id - b.id;
  const upcoming = all.filter((p) => p.status === 'planned' && p.planned_date >= t && p.planned_date <= addDays(t, 30)).sort(byDate);
  const overdue = all.filter((p) => p.status === 'planned' && p.planned_date < t).sort(byDate);
  const inMonth = all.filter((p) => p.status !== 'cancelled' && p.planned_date >= from && p.planned_date <= to);
  const planned = { income: stats.sum(inMonth.filter((p) => p.type === 'income')), expense: stats.sum(inMonth.filter((p) => p.type === 'expense')) };
  const actual = await stats.totals(u, from, to);
  ok(res, { upcoming: upcoming.map(mapAmt), overdue: overdue.map(mapAmt), month: { from, to, planned, actual: { income: actual.income, expense: actual.expense } } });
}));
module.exports = router;
