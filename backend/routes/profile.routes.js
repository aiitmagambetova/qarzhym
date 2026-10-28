const router = require('express').Router();
const store = require('../lib/store');
const { wrap, ok, check, HttpError } = require('../lib/util');
const { body, text } = require('../lib/validators');

router.get('/profile', wrap(async (req, res) => {
  const u = await store.getUser(req.session.userId);
  if (!u) throw new HttpError(401, 'Пайдаланушы табылмады');
  ok(res, { id: u.id, full_name: u.full_name, email: u.email, created_at: u.created_at });
}));
router.put('/profile', text('full_name', 100), body('full_name').isLength({ min: 2 }).withMessage('Аты-жөні кемінде 2 таңба'), wrap(async (req, res) => {
  check(req);
  await store.updateUser(req.session.userId, { full_name: req.body.full_name });
  ok(res, { full_name: req.body.full_name });
}));

router.get('/settings', wrap(async (req, res) => {
  const u = await store.getUser(req.session.userId);
  if (!u) throw new HttpError(401, 'Пайдаланушы табылмады');
  ok(res, u.settings);
}));
const bool = (f) => body(f).optional().isBoolean().withMessage('Мән қате').toBoolean();
router.put('/settings', body('theme').optional().isIn(['light', 'dark']), body('date_format').optional().isIn(['long', 'dots']),
  bool('notify_budget'), bool('notify_payments'), bool('notify_goals'),
  body('starting_balance').optional().custom((v) => /^-?\d+(\.\d{1,2})?$/.test(String(v)) && Math.abs(Number(v)) <= 1e10).withMessage('Бастапқы баланс дұрыс емес'),
  wrap(async (req, res) => {
    check(req);
    const allowed = ['theme', 'date_format', 'notify_budget', 'notify_payments', 'notify_goals', 'starting_balance'];
    const upd = {};
    allowed.forEach((k) => {
      const v = req.body[k]; if (v === undefined) return;
      upd[`settings.${k}`] = typeof v === 'boolean' ? Number(v) : k === 'starting_balance' ? Number(v) : v;
    });
    if (Object.keys(upd).length) await store.updateUser(req.session.userId, upd);
    ok(res, null);
  }));
module.exports = router;
