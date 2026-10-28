const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, n, r2, today, monthRange, diffDays, addMonths } = require('../lib/util');
const { query, date } = require('../lib/validators');
const stats = require('../lib/stats');

const V = [date('from', { optional: true, loc: query }), date('to', { optional: true, loc: query })];
function range(req) {
  const [f, l] = monthRange(today().slice(0, 7));
  const from = req.query.from || f, to = req.query.to || l;
  if (to < from) throw new HttpError(422, 'Аяқталу күні басталу күнінен кейін болуы керек');
  if (diffDays(from, to) > 3660) throw new HttpError(422, 'Кезең тым үлкен');
  return { from, to, days: diffDays(from, to) + 1 };
}

router.get('/summary', V, wrap(async (req, res) => {
  check(req); const u = req.session.userId; const { from, to, days } = range(req);
  const [txs, cats] = await Promise.all([stats.loadTx(u, from, to), store.list(u, 'categories')]);
  const t = stats.totalsOf(txs, from, to);
  const big = txs.filter((x) => x.type === 'expense').sort((a, b) => n(b.amount) - n(a.amount))[0];
  const top = stats.expenseByCategoryOf(txs, cats, from, to)[0];
  ok(res, { from, to, days, income: t.income, expense: t.expense, net: t.net, avg_daily_expense: r2(t.expense / days),
    largest_expense: big ? { id: big.id, title: big.title, amount: n(big.amount), tx_date: big.tx_date } : null, top_category: top || null, transaction_count: t.count });
}));

router.get('/income-expenses', V, query('group').optional().isIn(['day', 'month']), wrap(async (req, res) => {
  check(req); const { from, to } = range(req);
  const len = req.query.group === 'month' ? 7 : 10; const map = new Map();
  (await stats.loadTx(req.session.userId, from, to)).forEach((t) => {
    const label = t.tx_date.slice(0, len); const o = map.get(label) || { label, income: 0, expense: 0, _i: [], _e: [] };
    (t.type === 'income' ? o._i : o._e).push(t); map.set(label, o);
  });
  ok(res, [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).map((o) => ({ label: o.label, income: stats.sum(o._i), expense: stats.sum(o._e) })));
}));

router.get('/categories', V, wrap(async (req, res) => {
  check(req); const { from, to } = range(req);
  ok(res, await stats.expenseByCategory(req.session.userId, from, to));
}));

// Айлық серия + жинақталған баланс (бастапқы баланс + кірістер − шығыстар)
router.get('/monthly', query('months').optional().isInt({ min: 1, max: 60 }), wrap(async (req, res) => {
  check(req); const u = req.session.userId; const months = Number(req.query.months) || 12;
  const startMonth = addMonths(`${today().slice(0, 7)}-01`, -(months - 1));
  const txs = await stats.loadTx(u);
  const prior = stats.sum(txs.filter((t) => t.tx_date < startMonth).map((t) => ({ amount: t.type === 'income' ? n(t.amount) : -n(t.amount) })));
  let running = (await stats.startingBalance(u)) + prior;
  const out = [];
  for (let i = 0; i < months; i++) {
    const label = addMonths(startMonth, i).slice(0, 7);
    const sel = txs.filter((t) => t.tx_date.slice(0, 7) === label);
    const inc = stats.sum(sel.filter((t) => t.type === 'income')); const exp = stats.sum(sel.filter((t) => t.type === 'expense'));
    running = r2(running + inc - exp);
    out.push({ label, income: inc, expense: exp, net: r2(inc - exp), balance: running });
  }
  ok(res, out);
}));

router.get('/budgets', V, wrap(async (req, res) => {
  check(req); const { from, to } = range(req);
  ok(res, await stats.budgets(req.session.userId, (b) => b.start_date <= to && b.end_date >= from));
}));
module.exports = router;
