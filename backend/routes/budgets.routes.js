const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, addDays, addMonths } = require('../lib/util');
const { body, query, text, id, oneOf, date, amount } = require('../lib/validators');
const stats = require('../lib/stats');

const rules = [text('name', 100), amount(), body('category_id').isInt({ min: 1 }).withMessage('Санатты таңдаңыз'),
  oneOf('period', ['weekly', 'monthly', 'yearly', 'custom'], 'Мерзім түрі қате'), date('start_date'), date('end_date', { optional: true })];

async function prepare(req) {
  const b = req.body;
  const c = await store.get(req.session.userId, 'categories', Number(b.category_id));
  if (!c || c.type !== 'expense') throw new HttpError(422, 'Шығыс санатын таңдаңыз');
  let end = b.end_date;
  if (b.period === 'weekly') end = addDays(b.start_date, 6);
  else if (b.period === 'monthly') end = addDays(addMonths(b.start_date, 1), -1);
  else if (b.period === 'yearly') end = addDays(addMonths(b.start_date, 12), -1);
  else if (!end) throw new HttpError(422, 'Аяқталу күнін таңдаңыз');
  if (end < b.start_date) throw new HttpError(422, 'Аяқталу күні басталу күнінен кейін болуы керек');
  return end;
}
const payload = (b, end) => ({ category_id: Number(b.category_id), name: b.name, amount: Number(b.amount), period: b.period, start_date: b.start_date, end_date: end });

router.get('/', query('period').optional({ values: 'falsy' }).isIn(['weekly', 'monthly', 'yearly', 'custom']), wrap(async (req, res) => {
  check(req);
  ok(res, await stats.budgets(req.session.userId, (b) => !req.query.period || b.period === req.query.period));
}));
router.get('/:id', id, wrap(async (req, res) => {
  check(req);
  const [b] = await stats.budgets(req.session.userId, (x) => x.id === Number(req.params.id));
  if (!b) throw new HttpError(404, 'Бюджет табылмады');
  ok(res, b);
}));
router.post('/', rules, wrap(async (req, res) => {
  check(req); const end = await prepare(req);
  ok(res, { id: await store.add(req.session.userId, 'budgets', payload(req.body, end)) }, 201);
}));
router.put('/:id', id, rules, wrap(async (req, res) => {
  check(req); const end = await prepare(req);
  if (!(await store.update(req.session.userId, 'budgets', Number(req.params.id), payload(req.body, end)))) throw new HttpError(404, 'Бюджет табылмады');
  ok(res, null);
}));
router.delete('/:id', id, wrap(async (req, res) => {
  check(req);
  if (!(await store.remove(req.session.userId, 'budgets', Number(req.params.id)))) throw new HttpError(404, 'Бюджет табылмады');
  ok(res, null);
}));
module.exports = router;
