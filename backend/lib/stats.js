// Қаржылық есептеулердің бірыңғай орны. Барлық қосындылар тиындармен (бүтін сан) есептеледі — float қатесі болмайды.
const store = require('./store');
const { n, r2, pct } = require('./util');

const sum = (rows) => rows.reduce((s, r) => s + Math.round(n(r.amount) * 100), 0) / 100;
const loadTx = (uid, from, to) => store.list(uid, 'transactions', from || to ? { field: 'tx_date', from, to } : {});
const within = (d, from, to) => (!from || d >= from) && (!to || d <= to);

function totalsOf(txs, from, to) {
  const sel = txs.filter((t) => within(t.tx_date, from, to));
  const income = sum(sel.filter((t) => t.type === 'income')); const expense = sum(sel.filter((t) => t.type === 'expense'));
  return { income, expense, count: sel.length, net: r2(income - expense) };
}
async function totals(uid, from, to) { return totalsOf(await loadTx(uid, from, to), from, to); }

function expenseByCategoryOf(txs, cats, from, to) {
  const byId = new Map(cats.map((c) => [c.id, c])); const acc = new Map();
  txs.filter((t) => t.type === 'expense' && within(t.tx_date, from, to))
    .forEach((t) => acc.set(t.category_id, (acc.get(t.category_id) || 0) + Math.round(n(t.amount) * 100)));
  const rows = [...acc.entries()].filter(([cid]) => byId.has(cid)).map(([cid, cents]) => {
    const c = byId.get(cid); return { id: cid, name: c.name, color: c.color, icon: c.icon, total: cents / 100 };
  }).sort((a, b) => b.total - a.total);
  const all = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({ ...r, share: pct(r.total, all) }));
}
async function expenseByCategory(uid, from, to) {
  const [txs, cats] = await Promise.all([loadTx(uid, from, to), store.list(uid, 'categories')]);
  return expenseByCategoryOf(txs, cats, from, to);
}

// Бюджет бойынша нақты шығын: тек 'expense' транзакциялары, бюджет санаты мен мерзімі ішінде
// pred — бюджетті сүзу функциясы; pre — алдын ала жүктелген { txs, cats } (қайта оқымау үшін)
async function budgets(uid, pred = () => true, pre = {}) {
  const bs = (await store.list(uid, 'budgets')).filter(pred);
  if (!bs.length) return [];
  const [txs, cats] = await Promise.all([pre.txs || loadTx(uid), pre.cats || store.list(uid, 'categories')]);
  const byId = new Map(cats.map((c) => [c.id, c]));
  return bs.map((b) => {
    const c = byId.get(b.category_id) || {};
    const spent = sum(txs.filter((t) => t.type === 'expense' && t.category_id === b.category_id && t.tx_date >= b.start_date && t.tx_date <= b.end_date));
    return decorateBudget({ ...b, user_id: uid, category_name: c.name, color: c.color, icon: c.icon, spent });
  }).sort((a, b) => b.end_date.localeCompare(a.end_date) || b.id - a.id);
}
function decorateBudget(b) {
  const amount = n(b.amount), spent = n(b.spent), percent = pct(spent, amount);
  return { ...b, amount, spent, remaining: r2(amount - spent), percent, status: spent > amount ? 'exceeded' : percent >= 80 ? 'warning' : 'ok' };
}

async function savingsTotal(uid) { return sum((await store.list(uid, 'savings_goals')).map((g) => ({ amount: g.current_amount }))); }
async function startingBalance(uid) { const u = await store.getUser(uid); return n(u && u.settings.starting_balance); }

module.exports = { sum, loadTx, totals, totalsOf, expenseByCategory, expenseByCategoryOf, budgets, decorateBudget, savingsTotal, startingBalance };
