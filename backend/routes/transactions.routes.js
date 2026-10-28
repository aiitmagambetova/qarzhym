const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, n, r2 } = require('../lib/util');
const { body, query, text, id, oneOf, date, amount } = require('../lib/validators');
const { sum } = require('../lib/stats');

const rules = [text('title', 150), text('description', 500, false), amount(), oneOf('type', ['income', 'expense'], 'Түрі: кіріс немесе шығыс'),
  body('category_id').isInt({ min: 1 }).withMessage('Санатты таңдаңыз'), date('tx_date'), text('payment_method', 50, false), text('notes', 500, false)];

async function ownCategory(userId, categoryId, type) {
  const c = await store.get(userId, 'categories', Number(categoryId));
  if (!c) throw new HttpError(422, 'Санат табылмады');
  if (c.type !== type) throw new HttpError(422, 'Санат түрі транзакция түріне сәйкес келмейді');
}
const withCat = (t, byId) => { const c = byId.get(t.category_id) || {}; return { ...t, user_id: undefined, amount: n(t.amount), category_name: c.name, category_color: c.color, category_icon: c.icon }; };
const payload = (b) => ({ category_id: Number(b.category_id), title: b.title, description: b.description || null, amount: Number(b.amount), type: b.type,
  tx_date: b.tx_date, payment_method: b.payment_method || null, notes: b.notes || null });

router.get('/',
  query('type').optional({ values: 'falsy' }).isIn(['income', 'expense']), query('category_id').optional({ values: 'falsy' }).isInt({ min: 1 }),
  date('from', { optional: true, loc: query }), date('to', { optional: true, loc: query }),
  query('sort').optional().isIn(['date', 'amount']), query('order').optional().isIn(['asc', 'desc']),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  wrap(async (req, res) => {
    check(req); const u = req.session.userId; const q = req.query;
    // Firestore-ға тек күн диапазоны беріледі (бір өріс → индекс қажет емес), қалғаны жадта сүзіледі
    const [all, cats] = await Promise.all([store.list(u, 'transactions', q.from || q.to ? { field: 'tx_date', from: q.from || undefined, to: q.to || undefined } : {}), store.list(u, 'categories')]);
    const needle = q.q ? String(q.q).slice(0, 100).toLowerCase() : '';
    const rows = all.filter((t) => (!needle || String(t.title).toLowerCase().includes(needle))
      && (!q.type || t.type === q.type) && (!q.category_id || t.category_id === Number(q.category_id)));
    const dir = q.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const d = q.sort === 'amount' ? n(a.amount) - n(b.amount) : a.tx_date.localeCompare(b.tx_date);
      return d !== 0 ? d * dir : b.id - a.id;
    });
    const byId = new Map(cats.map((c) => [c.id, c]));
    const income = sum(rows.filter((t) => t.type === 'income')); const expense = sum(rows.filter((t) => t.type === 'expense'));
    ok(res, { items: rows.slice(0, Number(q.limit) || 200).map((t) => withCat(t, byId)), totals: { income, expense, count: rows.length, net: r2(income - expense) } });
  }));

router.get('/:id', id, wrap(async (req, res) => {
  check(req); const u = req.session.userId;
  const t = await store.get(u, 'transactions', Number(req.params.id));
  if (!t) throw new HttpError(404, 'Транзакция табылмады');
  const cats = await store.list(u, 'categories');
  ok(res, withCat(t, new Map(cats.map((c) => [c.id, c]))));
}));

router.post('/', rules, wrap(async (req, res) => {
  check(req);
  const b = req.body; await ownCategory(req.session.userId, b.category_id, b.type);
  ok(res, { id: await store.add(req.session.userId, 'transactions', payload(b)) }, 201);
}));

router.put('/:id', id, rules, wrap(async (req, res) => {
  check(req);
  const b = req.body; await ownCategory(req.session.userId, b.category_id, b.type);
  if (!(await store.update(req.session.userId, 'transactions', Number(req.params.id), payload(b)))) throw new HttpError(404, 'Транзакция табылмады');
  ok(res, null);
}));

router.delete('/:id', id, wrap(async (req, res) => {
  check(req);
  if (!(await store.remove(req.session.userId, 'transactions', Number(req.params.id)))) throw new HttpError(404, 'Транзакция табылмады');
  ok(res, null);
}));
module.exports = router;
