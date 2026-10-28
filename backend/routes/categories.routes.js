const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, n } = require('../lib/util');
const { body, text, id, oneOf, query } = require('../lib/validators');
const { COLORS, ICONS } = require('../lib/defaults');
const { sum } = require('../lib/stats');

const rules = [text('name', 60), oneOf('type', ['income', 'expense'], 'Түрі: кіріс немесе шығыс'),
  oneOf('color', COLORS, 'Түс тізімнен таңдалуы керек'), body('icon').optional({ values: 'falsy' }).isIn(ICONS).withMessage('Белгіше тізімнен таңдалуы керек')];

const sameName = (a, b) => a.type === b.type && a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
async function assertUnique(u, c, selfId) {
  const all = await store.list(u, 'categories');
  if (all.some((x) => x.id !== selfId && sameName(x, c))) throw new HttpError(409, 'Мұндай жазба бұрыннан бар');
}
// Санат қолданыста ма: { tx, budgets, planned } саны
async function usage(u, cid) {
  const [a, b, p] = await Promise.all(['transactions', 'budgets', 'planned_transactions'].map((c) => store.list(u, c, { where: ['category_id', cid] })));
  return { a: a.length, b: b.length, p: p.length };
}

router.get('/', query('type').optional().isIn(['income', 'expense']), wrap(async (req, res) => {
  check(req); const u = req.session.userId;
  const [cats, txs] = await Promise.all([store.list(u, 'categories'), store.list(u, 'transactions')]);
  const items = cats.filter((c) => !req.query.type || c.type === req.query.type)
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'kk'))
    .map((c) => { const mine = txs.filter((t) => t.category_id === c.id); return { ...c, user_id: u, tx_count: mine.length, tx_total: sum(mine) }; });
  ok(res, { items, colors: COLORS, icons: ICONS });
}));

router.post('/', rules, wrap(async (req, res) => {
  check(req);
  const { name, type, color, icon } = req.body;
  await assertUnique(req.session.userId, { name, type });
  ok(res, { id: await store.add(req.session.userId, 'categories', { name, type, color, icon: icon || null }) }, 201);
}));

router.put('/:id', id, rules, wrap(async (req, res) => {
  check(req); const u = req.session.userId; const cid = Number(req.params.id);
  const c = await store.get(u, 'categories', cid);
  if (!c) throw new HttpError(404, 'Санат табылмады');
  const { name, type, color, icon } = req.body;
  if (type !== c.type) {
    const x = await usage(u, cid);
    if (x.a + x.b > 0) throw new HttpError(409, 'Қолданыстағы санаттың түрін өзгертуге болмайды');
  }
  await assertUnique(u, { name, type }, cid);
  await store.update(u, 'categories', cid, { name, type, color, icon: icon || null });
  ok(res, null);
}));

// Стратегия: қолданыстағы санатты жоюға тыйым салынады (тарихи деректер жоғалмайды)
router.delete('/:id', id, wrap(async (req, res) => {
  check(req); const u = req.session.userId; const cid = Number(req.params.id);
  if (!(await store.get(u, 'categories', cid))) throw new HttpError(404, 'Санат табылмады');
  const x = await usage(u, cid);
  if (x.a + x.b + x.p > 0) throw new HttpError(409, `Санат қолданыста (транзакция: ${x.a}, бюджет: ${x.b}, жоспар: ${x.p}). Алдымен оларды басқа санатқа ауыстырыңыз немесе жойыңыз.`);
  await store.remove(u, 'categories', cid);
  ok(res, null);
}));
module.exports = router;
