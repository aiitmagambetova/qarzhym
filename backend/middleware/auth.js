const { HttpError } = require('../lib/util');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next(new HttpError(401, 'Жүйеге кіру қажет. Сессия аяқталған болуы мүмкін.'));
  }
  next();
}

// CSRF: cookie-негізді аутентификация үшін синхронизатор-токен (X-CSRF-Token тақырыбы)
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.get('x-csrf-token');
  if (!req.session || !req.session.csrf || !token || token !== req.session.csrf) {
    return next(new HttpError(403, 'Қауіпсіздік токені жарамсыз. Бетті жаңартып қайталаңыз.'));
  }
  next();
}

module.exports = { requireAuth, csrfProtection };
