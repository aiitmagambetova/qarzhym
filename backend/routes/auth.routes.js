const router = require('express').Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const store = require('../lib/store');
const { requireAuth } = require('../middleware/auth');
const { wrap, ok, check, HttpError } = require('../lib/util');
const { body } = require('../lib/validators');
const { DEFAULT_CATEGORIES } = require('../lib/defaults');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Тым көп әрекет. 15 минуттан кейін қайталаңыз.' } });
const pwRule = (f) => body(f).isLength({ min: 8, max: 72 }).withMessage('Құпиясөз кемінде 8 таңба болуы керек')
  .matches(/[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүІіҺһ]/).withMessage('Құпиясөзде әріп болуы керек').matches(/\d/).withMessage('Құпиясөзде сан болуы керек');

const startSession = (req, userId) => new Promise((resolve, reject) => {
  req.session.regenerate((err) => {
    if (err) return reject(err);
    req.session.userId = userId;
    req.session.csrf = crypto.randomBytes(24).toString('hex');
    req.session.save((e) => (e ? reject(e) : resolve(req.session.csrf)));
  });
});
const publicUser = (u) => ({ id: u.id, full_name: u.full_name, email: u.email });

router.post('/register', limiter,
  body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Аты-жөні 2–100 таңба болуы керек'),
  body('email').trim().isEmail().withMessage('Электрондық пошта дұрыс емес').isLength({ max: 255 }).normalizeEmail(),
  pwRule('password'),
  body('confirm_password').custom((v, { req }) => v === req.body.password).withMessage('Құпиясөздер сәйкес келмейді'),
  wrap(async (req, res) => {
    check(req);
    const { full_name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const userId = await store.createUser({ full_name, email, password_hash: hash,
      categories: DEFAULT_CATEGORIES.map((d) => ({ name: d[0], type: d[1], color: d[2], icon: d[3] })) });
    if (!userId) throw new HttpError(409, 'Бұл пошта бұрын тіркелген'); // email бірегейлігі атомарлы тексеріледі
    const csrfToken = await startSession(req, userId);
    ok(res, { user: { id: userId, full_name, email }, csrfToken }, 201);
  }));

router.post('/login', limiter,
  body('email').trim().isEmail().withMessage('Электрондық пошта дұрыс емес').normalizeEmail(),
  body('password').notEmpty().withMessage('Құпиясөзді енгізіңіз'),
  wrap(async (req, res) => {
    check(req);
    const u = await store.findUserByEmail(req.body.email);
    const good = u && await bcrypt.compare(req.body.password, u.password_hash);
    if (!good) throw new HttpError(401, 'Пошта немесе құпиясөз қате');
    const csrfToken = await startSession(req, u.id);
    ok(res, { user: publicUser(u), csrfToken });
  }));

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('qarzhym.sid');
    res.json({ success: true, data: null });
  });
});

router.get('/me', requireAuth, wrap(async (req, res) => {
  const u = await store.getUser(req.session.userId);
  if (!u) throw new HttpError(401, 'Пайдаланушы табылмады');
  ok(res, { user: { id: u.id, full_name: u.full_name, email: u.email, created_at: u.created_at }, settings: u.settings });
}));

router.post('/change-password', requireAuth, limiter,
  body('current_password').notEmpty().withMessage('Ағымдағы құпиясөзді енгізіңіз'),
  pwRule('new_password'),
  body('confirm_password').custom((v, { req }) => v === req.body.new_password).withMessage('Жаңа құпиясөздер сәйкес келмейді'),
  wrap(async (req, res) => {
    check(req);
    const u = await store.getUser(req.session.userId);
    if (!u) throw new HttpError(401, 'Пайдаланушы табылмады');
    if (!(await bcrypt.compare(req.body.current_password, u.password_hash))) throw new HttpError(400, 'Ағымдағы құпиясөз қате');
    await store.updateUser(req.session.userId, { password_hash: await bcrypt.hash(req.body.new_password, 12) });
    ok(res, null);
  }));

module.exports = router;
