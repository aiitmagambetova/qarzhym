const { validationResult } = require('express-validator');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
function check(req) {
  const e = validationResult(req);
  if (!e.isEmpty()) throw new HttpError(422, e.array()[0].msg);
}
const n = (v) => Number(v || 0);
const r2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const pct = (a, b) => (n(b) > 0 ? Math.round((n(a) / n(b)) * 1000) / 10 : 0); // нөлге бөлуден қорғау

const p2 = (x) => String(x).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const parts = (s) => s.split('-').map(Number);
function addDays(s, k) { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); }
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function addMonths(s, k) {
  const [y, m, d] = parts(s); const t = (y * 12 + (m - 1)) + k;
  const ny = Math.floor(t / 12), nm = (t % 12) + 1;
  return `${ny}-${p2(nm)}-${p2(Math.min(d, lastDay(ny, nm)))}`;
}
function monthRange(ym) { const [y, m] = ym.split('-').map(Number); return [`${y}-${p2(m)}-01`, `${y}-${p2(m)}-${p2(lastDay(y, m))}`]; }
const diffDays = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

// Қалған жарна айлары: толық емес ай толық ай болып саналады.
function remainingMonths(targetDate, from = today()) {
  const [y, m, d] = parts(from); const [ty, tm, td] = parts(targetDate);
  if (targetDate <= from) return 0;
  return (ty - y) * 12 + (tm - m) + (td > d ? 1 : 0);
}
function plan(target, current, targetDate) {
  const remaining = Math.max(0, r2(n(target) - n(current)));
  const progress = Math.min(100, pct(current, target));
  if (remaining === 0) return { remaining, progress, state: 'completed', months_left: 0, monthly_estimate: 0 };
  if (!targetDate) return { remaining, progress, state: 'no_date', months_left: null, monthly_estimate: null };
  const months = remainingMonths(targetDate);
  if (months <= 0) return { remaining, progress, state: 'overdue', months_left: 0, monthly_estimate: remaining };
  return { remaining, progress, state: 'active', months_left: months, monthly_estimate: r2(remaining / months) };
}

module.exports = { HttpError, wrap, ok, check, n, r2, pct, today, addDays, addMonths, monthRange, diffDays, remainingMonths, plan, lastDay };
