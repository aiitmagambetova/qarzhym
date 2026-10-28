const path = require('path');
const crypto = require('crypto');
const { db } = require('./config/firebase'); // .env-ті де осы жерде жүктейді
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const FirestoreStore = require('./lib/firestore-session-store')(session);
const { requireAuth, csrfProtection } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error-handler');

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.startsWith('change_me'))) {
  console.error('SESSION_SECRET орнатылмаған! .env файлын толтырыңыз.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
}));
app.use(express.json({ limit: '100kb' }));

const store = new FirestoreStore({ db, ttl: 1000 * 60 * 60 * 24 * 7 });
app.use(session({
  name: 'qarzhym.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-secret',
  store, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 1000 * 60 * 60 * 24 * 7 },
}));

app.get('/api/health', async (req, res) => {
  try { await db.collection('_meta').doc('ping').get(); res.json({ success: true, status: 'ok', database: 'ok' }); }
  catch { res.status(503).json({ success: false, status: 'error', database: 'unavailable' }); }
});
app.get('/api/auth/csrf', (req, res) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.json({ success: true, data: { csrfToken: req.session.csrf } });
});

app.use('/api', csrfProtection);
app.use('/api/auth', require('./routes/auth.routes'));
const priv = (p, r) => app.use(p, requireAuth, require(`./routes/${r}.routes`));
priv('/api/dashboard', 'dashboard');
priv('/api/transactions', 'transactions');
priv('/api/budgets', 'budgets');
priv('/api/calendar', 'calendar');
priv('/api/categories', 'categories');
priv('/api/reports', 'reports');
priv('/api/savings', 'savings');
priv('/api/planner', 'planner');
priv('/api/notifications', 'notifications');
priv('/api', 'profile'); // /api/profile, /api/settings

app.use('/api', notFound);
app.use(express.static(process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend'), { extensions: ['html'] }));
app.use(errorHandler);
module.exports = app;
