const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, n, r2, pct, today, monthRange, addMonths, addDays, plan } = require('../lib/util');
const { query } = require('../lib/validators');
const stats = require('../lib/stats');

// Диаграмма бағаналары: labels бойынша кіріс/шығыс қосындысы
const bucket = (labels, keyOf, txs) => labels.map((label) => {
  const sel = txs.filter((t) => keyOf(t) === label);
  return { label, income: stats.sum(sel.filter((t) => t.type === 'income')), expense: stats.sum(sel.filter((t) => t.type === 'expense')) };
});

router.get('/', query('month').optional({ values: 'falsy' }).matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Ай форматы қате'),
  query('months').optional().isInt({ min: 1, max: 24 }), query('range').optional().isIn(['week', 'month', 'year']), wrap(async (req, res) => {
    check(req); const u = req.session.userId;
    const month = req.query.month || today().slice(0, 7); const months = Number(req.query.months) || 6;
    const [from, to] = monthRange(month); const prevMonth = addMonths(`${month}-01`, -1).slice(0, 7); const [pf, pt] = monthRange(prevMonth);
    const t0 = today();

    // Барлық деректі бір рет оқимыз, қалғанының бәрі жадта есептеледі
    const [txAll, cats, start, savings, goalsAll] = await Promise.all([
      stats.loadTx(u), store.list(u, 'categories'), stats.startingBalance(u), stats.savingsTotal(u), store.list(u, 'savings_goals')]);
    const all = stats.totalsOf(txAll);
    const cur = stats.totalsOf(txAll, from, to); const prev = stats.totalsOf(txAll, pf, pt);
    const catsM = stats.expenseByCategoryOf(txAll, cats, from, to);
    const upToPrev = stats.totalsOf(txAll, undefined, pt);
    const balPrev = r2(start + upToPrev.income - upToPrev.expense); const balNow = r2(start + upToPrev.income - upToPrev.expense + cur.income - cur.expense);

    // Диаграмма: week — соңғы 7 күн, month — соңғы N ай, year — соңғы 5 жыл
    const range = req.query.range || 'month';
    let chart;
    if (range === 'week') {
      chart = bucket(Array.from({ length: 7 }, (_, i) => addDays(t0, i - 6)), (t) => t.tx_date, txAll);
    } else if (range === 'year') {
      const y1 = Number(month.slice(0, 4));
      chart = bucket(Array.from({ length: 5 }, (_, i) => String(y1 - 4 + i)), (t) => t.tx_date.slice(0, 4), txAll);
    } else {
      const chartFrom = addMonths(`${month}-01`, -(months - 1));
      chart = bucket(Array.from({ length: months }, (_, i) => addMonths(chartFrom, i).slice(0, 7)), (t) => t.tx_date.slice(0, 7), txAll);
    }

    const byId = new Map(cats.map((c) => [c.id, c]));
    const recent = [...txAll].sort((a, b) => b.tx_date.localeCompare(a.tx_date) || b.id - a.id).slice(0, 6).map((t) => {
      const c = byId.get(t.category_id) || {};
      return { id: t.id, title: t.title, amount: n(t.amount), type: t.type, tx_date: t.tx_date, category_name: c.name, category_color: c.color, category_icon: c.icon };
    });
    const budgets = await stats.budgets(u, (b) => b.start_date <= to && b.end_date >= from, { txs: txAll, cats });
    const goals = goalsAll.filter((g) => g.status === 'active')
      .sort((a, b) => (a.target_date === null) - (b.target_date === null) || String(a.target_date).localeCompare(String(b.target_date)) || a.id - b.id).slice(0, 4);

    ok(res, {
      month,
      summary: { balance: r2(start + all.income - all.expense), income: all.income, expense: all.expense, savings, starting_balance: start },
      month_stats: { income: cur.income, expense: cur.expense, prev_expense: prev.expense, prev_income: prev.income,
        income_change_percent: prev.income > 0 ? pct(cur.income - prev.income, prev.income) : null,
        balance_change_percent: Math.abs(balPrev) > 0 ? Math.round(((balNow - balPrev) / Math.abs(balPrev)) * 1000) / 10 : null, expense_diff: r2(cur.expense - prev.expense),
        expense_change_percent: prev.expense > 0 ? pct(cur.expense - prev.expense, prev.expense) : null },
      largest_category: catsM[0] || null, categories: catsM, chart, recent,
      budgets, near_limit: budgets.filter((b) => b.status !== 'ok'),
      goals: goals.map((g) => ({ ...g, target_amount: n(g.target_amount), current_amount: n(g.current_amount), ...plan(g.target_amount, g.current_amount, g.target_date) })),
      range, today: t0,
    });
  }));
module.exports = router;
