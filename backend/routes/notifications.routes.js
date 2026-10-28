const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, today, addDays } = require('../lib/util');
const { id } = require('../lib/validators');
const stats = require('../lib/stats');

// Хабарландыруларды dedupe_key арқылы бір рет қана жасайды (беттi жаңартқанда қайталанбайды).
// Бірегейлік: notification_keys/{key} құжаты batch ішінде create() арқылы жасалады — қатар сұраныста да қайталанбайды.
async function sync(u, existing) {
  const s = (await store.getUser(u)).settings;
  const rows = []; const t = today();
  if (s.notify_budget) {
    for (const b of await stats.budgets(u, (x) => x.start_date <= t && x.end_date >= t)) {
      const k = `${b.id}:${b.start_date}`;
      if (b.status === 'exceeded') rows.push(['budget_exceeded', 'Бюджет лимитінен асып кетті', `«${b.name}»: ${b.percent}% пайдаланылды`, 'budgets.html', `bx:${k}`]);
      else if (b.status === 'warning') rows.push(['budget_warning', 'Бюджет лимиті жақындады', `«${b.name}»: лимиттің ${b.percent}%-ы пайдаланылды`, 'budgets.html', `bw:${k}`]);
    }
  }
  if (s.notify_payments) {
    const lim = addDays(t, 3);
    (await store.list(u, 'planned_transactions')).filter((p) => p.status === 'planned' && p.type === 'expense' && p.planned_date <= lim).forEach((p) => {
      if (p.planned_date < t) rows.push(['payment_overdue', 'Төлем мерзімі өтіп кетті', `«${p.title}» — ${p.planned_date}`, 'financial-planner.html', `po:${p.id}`]);
      else rows.push(['payment_due', 'Төлем мерзімі жақындады', `«${p.title}» — ${p.planned_date}`, 'financial-planner.html', `pd:${p.id}`]);
    });
  }
  if (s.notify_goals) {
    (await store.list(u, 'savings_goals')).filter((g) => g.status === 'active' && g.current_amount >= g.target_amount * 0.9)
      .forEach((g) => rows.push(['goal_progress', 'Жинақ мақсатына жетуге аз қалды', `«${g.title}»: мақсаттың 90%-ынан астамы жиналды`, 'savings.html', `g90:${g.id}`]));
  }
  for (const [type, title, message, link, key] of rows) {
    if (existing.has(key)) continue;
    const nid = store.newId(); const b = store.db.batch();
    b.create(store.ref(u, 'notification_keys', encodeURIComponent(key)), { notification_id: nid });
    b.create(store.ref(u, 'notifications', nid), { type, title, message, link, dedupe_key: key, is_read: 0, is_dismissed: 0, created_at: store.nowTs() });
    try { await b.commit(); } catch (e) { if (e.code !== 6) throw e; } // 6 = бұрын жасалған
  }
}

router.get('/', wrap(async (req, res) => {
  const u = req.session.userId;
  let all = await store.list(u, 'notifications');
  await sync(u, new Set(all.map((x) => x.dedupe_key)));
  all = await store.list(u, 'notifications');
  const visible = all.filter((x) => !x.is_dismissed)
    .sort((a, b) => a.is_read - b.is_read || b.created_at.localeCompare(a.created_at) || b.id - a.id);
  ok(res, { items: visible.slice(0, 100).map(({ id: i, type, title, message, link, is_read, created_at }) => ({ id: i, type, title, message, link, is_read, created_at })),
    unread: visible.filter((x) => !x.is_read).length });
}));
router.patch('/read-all', wrap(async (req, res) => {
  const u = req.session.userId;
  const unread = await store.list(u, 'notifications', { where: ['is_read', 0] });
  for (let i = 0; i < unread.length; i += 400) {
    const b = store.db.batch(); unread.slice(i, i + 400).forEach((x) => b.update(store.ref(u, 'notifications', x.id), { is_read: 1 })); await b.commit();
  }
  ok(res, null);
}));
router.patch('/:id/read', id, wrap(async (req, res) => {
  check(req);
  if (!(await store.update(req.session.userId, 'notifications', Number(req.params.id), { is_read: 1 }))) throw new HttpError(404, 'Хабарландыру табылмады');
  ok(res, null);
}));
router.delete('/:id', id, wrap(async (req, res) => {
  check(req); // is_dismissed белгіленеді: dedupe_key сақталады, хабарландыру қайта шықпайды
  if (!(await store.update(req.session.userId, 'notifications', Number(req.params.id), { is_dismissed: 1, is_read: 1 }))) throw new HttpError(404, 'Хабарландыру табылмады');
  ok(res, null);
}));
module.exports = router;
