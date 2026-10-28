exports.notFound = (req, res) =>
  res.status(404).json({ success: false, message: 'Сұралған ресурс табылмады' });

exports.errorHandler = (err, req, res, next) => { // eslint-disable-line
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Сұраныс форматы қате' });
  if (err.status && err.status < 500) return res.status(err.status).json({ success: false, message: err.message });
  console.error('[ERROR]', err.code || '', err.message); // стек клиентке жіберілмейді
  res.status(500).json({ success: false, message: 'Сервер қатесі. Кейінірек қайталап көріңіз.' });
};
