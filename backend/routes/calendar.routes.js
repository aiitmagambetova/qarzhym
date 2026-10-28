const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError, n } = require('../lib/util');
const { body, query, text, id, oneOf, date } = require('../lib/validators');
const stats = require('../lib/stats');

const TYPES = ['rent', 'utility', 'loan', 'subscription', 'purchase', 'saving', 'other'];
const rules = [text('title', 150), text('description', 500, false), date('event_date'), oneOf('event_type', TYPES, 'Оқиға түрі қате'),
  body('amount').optional({ values: 'falsy' }).custom((v) => /^\d+(\.\d{1,2})?$/.test(String(v)) && Number(v) <= 1e10).withMessage('Сома дұрыс емес')];
const payload = (b) => ({ title: b.title, description: b.description || null, event_date: b.event_date, amount: b.amount ? Number(b.amount) : null, event_type: b.event_type });

// Нақты транзакциялар, жоспарланған төлемдер және жеке оқиғалар бөлек қайтарылады.
// Жоспарланған төлемдер нақты шығынға АВТОМАТТЫ қосылмайды.
router.get('/', date('from', { loc: query }), date('to', { loc: query }), wrap(async (req, res) => {
  check(req); const u = req.session.userId; const { from, to } = req.query;
  const [events, txs, planned] = await Promise.all([
    store.list(u, 'calendar_events', { field: 'event_date', from, to }),
    stats.loadTx(u, from, to),
    store.list(u, 'planned_transactions', { field: 'planned_date', from, to }),
  ]);
  ok(res, {
    events: events.sort((a, b) => a.event_date.localeCompare(b.event_date)).map((e) => ({ ...e, amount: e.amount == null ? null : n(e.amount) })),
    transactions: txs.map((t) => ({ id: t.id, title: t.title, amount: n(t.amount), type: t.type, tx_date: t.tx_date })),
    planned: planned.filter((p) => p.status !== 'cancelled').map((p) => ({ id: p.id, title: p.title, amount: n(p.amount), type: p.type, planned_date: p.planned_date, status: p.status })),
  });
}));
router.post('/', rules, wrap(async (req, res) => {
  check(req);
  ok(res, { id: await store.add(req.session.userId, 'calendar_events', payload(req.body)) }, 201);
}));
router.put('/:id', id, rules, wrap(async (req, res) => {
  check(req);
  if (!(await store.update(req.session.userId, 'calendar_events', Number(req.params.id), payload(req.body)))) throw new HttpError(404, 'Оқиға табылмады');
  ok(res, null);
}));
router.delete('/:id', id, wrap(async (req, res) => {
  check(req);
  if (!(await store.remove(req.session.userId, 'calendar_events', Number(req.params.id)))) throw new HttpError(404, 'Оқиға табылмады');
  ok(res, null);
}));
module.exports = router;
