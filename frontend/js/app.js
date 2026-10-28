// Ортақ қабықша, UI көмекшілері және форма құрастырушылар
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
const MSHORT = ['Қаң', 'Ақп', 'Нау', 'Сәу', 'Мам', 'Мау', 'Шіл', 'Там', 'Қыр', 'Қаз', 'Қар', 'Жел'];
const WDAYS = ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жк'];
const money = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(v) || 0).replace(/\u00a0/g, ' ') + ' ₸';
const pad = (x) => String(x).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // жергілікті күн, UTC ығысуынсыз
const todayStr = () => ymd(new Date());
function fmtDate(s) {
  if (!s) return '—'; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return (window.App && App.settings && App.settings.date_format === 'dots') ? `${pad(d)}.${pad(m)}.${y}` : `${d} ${MONTHS[m - 1]} ${y}`;
}
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`; };
const PERIODS = { weekly: 'Апталық', monthly: 'Айлық', yearly: 'Жылдық', custom: 'Таңдалған мерзім' };
const EVENT_TYPES = { rent: 'Жалдау ақысы', utility: 'Коммуналдық төлем', loan: 'Несие төлемі', subscription: 'Жазылым төлемі', purchase: 'Жоспарланған сатып алу', saving: 'Жинаққа ақша салу', other: 'Басқа' };

const UI = {
  toast(msg, err) {
    let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; box.append(t); setTimeout(() => t.remove(), 4000);
  },
  loading(el) { el.innerHTML = '<div class="state"><div class="spinner"></div>Жүктелуде...</div>'; },
  error(el, msg, retry) {
    el.innerHTML = `<div class="state">⚠️ ${esc(msg)}<br><br><button class="btn sm" id="retry-btn">Қайталау</button></div>`;
    if (retry) $('#retry-btn', el).onclick = retry;
  },
  modal(title, node) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog');
    const h = document.createElement('h3'); h.textContent = title; m.append(h, node); bg.append(m); document.body.append(bg);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    return close;
  },
  confirm(message, okText = 'Жою') {
    return new Promise((resolve) => {
      const box = document.createElement('div'); box.innerHTML = `<p>${esc(message)}</p><div class="acts"><button class="btn ghost" data-r="0">Бас тарту</button><button class="btn danger" data-r="1">${esc(okText)}</button></div>`;
      const close = UI.modal('Растау', box);
      box.querySelectorAll('button').forEach((b) => { b.onclick = () => { close(); resolve(b.dataset.r === '1'); }; });
    });
  },
  // fields: [{name,label,type,options:[[v,l]],required,value,step,min,placeholder,full}]
  form({ title, fields, submitText = 'Сақтау', onSubmit }) {
    const f = document.createElement('form'); f.noValidate = false;
    f.innerHTML = fields.map((x) => {
      const id = 'f_' + x.name; const v = x.value ?? '';
      let input;
      if (x.type === 'select') input = `<select id="${id}" name="${x.name}" ${x.required ? 'required' : ''}>${(x.options || []).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
      else if (x.type === 'textarea') input = `<textarea id="${id}" name="${x.name}" rows="2" maxlength="500">${esc(v)}</textarea>`;
      else input = `<input id="${id}" name="${x.name}" type="${x.type || 'text'}" value="${esc(v)}" ${x.required ? 'required' : ''} ${x.type === 'number' ? `step="${x.step || '0.01'}" min="${x.min ?? 0}" inputmode="decimal"` : ''} ${x.placeholder ? `placeholder="${esc(x.placeholder)}"` : ''} maxlength="${x.type === 'number' ? 20 : 150}">`;
      return `<div class="field"><label for="${id}">${esc(x.label)}${x.required ? ' *' : ''}</label>${input}</div>`;
    }).join('') + '<div class="form-err" role="alert"></div><div class="acts"><button type="button" class="btn ghost" data-cancel>Бас тарту</button><button class="btn" type="submit"></button></div>';
    const sb = $('button[type=submit]', f); sb.textContent = submitText;
    const close = UI.modal(title, f);
    $('[data-cancel]', f).onclick = close;
    f.onsubmit = async (e) => {
      e.preventDefault(); if (sb.disabled) return; // қайталап жіберуден қорғау
      const data = {}; new FormData(f).forEach((val, k) => { if (String(val).trim() !== '') data[k] = String(val).trim(); });
      sb.disabled = true; $('.form-err', f).textContent = '';
      try { await onSubmit(data); close(); }
      catch (err) { $('.form-err', f).textContent = err.message; sb.disabled = false; }
    };
    return f;
  },
  progress(p, status) { return `<div class="progress ${status === 'exceeded' ? 'bad' : status === 'warning' ? 'warn' : ''}"><i style="width:${Math.min(100, p)}%"></i></div>`; },
  empty(msg, btn) { return `<div class="empty">📭 ${esc(msg)}${btn ? `<br><br>${btn}` : ''}</div>`; },
};

// Ортақ формалар (бірнеше беттен қолданылады)
const Forms = {
  async cats(type) { return (await API.get('/api/categories', type ? { type } : {})).items; },
  async transaction(done, tx = {}, presetType) {
    const type = tx.type || presetType || 'expense';
    const all = await Forms.cats();
    const opts = (t) => all.filter((c) => c.type === t).map((c) => [c.id, c.name]);
    const f = UI.form({
      title: tx.id ? 'Транзакцияны өзгерту' : (type === 'income' ? 'Кіріс қосу' : 'Шығыс қосу'),
      fields: [
        { name: 'type', label: 'Түрі', type: 'select', options: [['income', 'Кіріс'], ['expense', 'Шығыс']], value: type, required: true },
        { name: 'title', label: 'Атауы', required: true, value: tx.title }, { name: 'amount', label: 'Сома (₸)', type: 'number', required: true, value: tx.amount },
        { name: 'category_id', label: 'Санат', type: 'select', options: opts(type), value: tx.category_id, required: true },
        { name: 'tx_date', label: 'Күні', type: 'date', required: true, value: (tx.tx_date || todayStr()).slice(0, 10) },
        { name: 'payment_method', label: 'Төлем әдісі', value: tx.payment_method }, { name: 'description', label: 'Сипаттама', type: 'textarea', value: tx.description }, { name: 'notes', label: 'Ескертпе', type: 'textarea', value: tx.notes },
      ],
      onSubmit: async (d) => { tx.id ? await API.put(`/api/transactions/${tx.id}`, d) : await API.post('/api/transactions', d); UI.toast('Сақталды'); done && done(); },
    });
    f.type.onchange = () => { f.category_id.innerHTML = opts(f.type.value).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(''); };
  },
  async budget(done, b = {}) {
    const cats = await Forms.cats('expense');
    const f = UI.form({
      title: b.id ? 'Бюджетті өзгерту' : 'Бюджет құру',
      fields: [
        { name: 'name', label: 'Бюджет атауы', required: true, value: b.name }, { name: 'category_id', label: 'Санат', type: 'select', required: true, options: cats.map((c) => [c.id, c.name]), value: b.category_id },
        { name: 'amount', label: 'Бюджет сомасы (₸)', type: 'number', required: true, value: b.amount },
        { name: 'period', label: 'Мерзімі', type: 'select', required: true, options: Object.entries(PERIODS), value: b.period || 'monthly' },
        { name: 'start_date', label: 'Басталу күні', type: 'date', required: true, value: b.start_date || todayStr().slice(0, 8) + '01' },
        { name: 'end_date', label: 'Аяқталу күні (тек «Таңдалған мерзім» үшін)', type: 'date', value: b.end_date },
      ],
      onSubmit: async (d) => { b.id ? await API.put(`/api/budgets/${b.id}`, d) : await API.post('/api/budgets', d); UI.toast('Бюджет сақталды'); done && done(); },
    });
    if (!cats.length) UI.toast('Алдымен шығыс санатын жасаңыз', true);
    return f;
  },
  saving(done, g = {}) {
    UI.form({
      title: g.id ? 'Жинақ мақсатын өзгерту' : 'Жинақ мақсатын қосу',
      fields: [{ name: 'title', label: 'Атауы', required: true, value: g.title, placeholder: 'Мысалы: Ноутбук сатып алу' },
        { name: 'target_amount', label: 'Мақсатты сома (₸)', type: 'number', required: true, value: g.target_amount }, { name: 'target_date', label: 'Мақсатты күн', type: 'date', value: g.target_date },
        ...(g.id ? [{ name: 'status', label: 'Күйі', type: 'select', options: [['active', 'Белсенді'], ['completed', 'Аяқталған']], value: g.status }] : []),
        { name: 'description', label: 'Сипаттама', type: 'textarea', value: g.description }],
      onSubmit: async (d) => { g.id ? await API.put(`/api/savings/${g.id}`, d) : await API.post('/api/savings', d); UI.toast('Сақталды'); done && done(); },
    });
  },
};

// SVG белгішелер (сызықты стиль)
const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  tx: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  budget: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M8 17h2"/>',
  report: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  plan: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h4"/><path d="M13.5 16l1.8 1.8L19 14"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  bell: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  chev: '<path d="M6 9l6 6 6-6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  trend: '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pie: '<path d="M21 12A9 9 0 1112 3v9h9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>',
  plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  leaf: '<path d="M5 21c0-9 5-15 15-17 0 9-4 15-13 15"/><path d="M5 21c2-5 5-8 9-10"/>',
  out: '<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  piggy: '<path d="M4 12a8 6 0 0116 0c0 2-1 3.5-2.5 4.5V19h-3v-1.5h-5V19h-3v-2.5C5 15.5 4 14 4 12z"/><path d="M20 11h2M9 10h.01"/>',
};
const ico = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

const NAV = [['index.html', 'Басты бет', 'home'], ['transactions.html', 'Транзакциялар', 'tx'], ['budgets.html', 'Бюджет', 'budget'], ['calendar.html', 'Күнтізбе', 'calendar'],
  ['reports.html', 'Қаржылық есептер', 'report'], ['savings.html', 'Жинақтар', 'box'], ['financial-planner.html', 'Қаржылық жоспар', 'plan'], ['categories.html', 'Санаттар', 'tag'],
  ['notifications.html', 'Хабарландырулар', 'bell'], ['profile.html', 'Профиль', 'user'], ['settings.html', 'Баптаулар', 'gear']];
const TITLES = { 'index.html': 'Қаржылық шолу', 'transactions.html': 'Транзакциялар', 'budgets.html': 'Бюджет', 'calendar.html': 'Қаржылық күнтізбе', 'reports.html': 'Қаржылық есептер',
  'savings.html': 'Жинақтар', 'financial-planner.html': 'Қаржылық жоспар', 'categories.html': 'Санаттар', 'notifications.html': 'Хабарландырулар', 'profile.html': 'Профиль', 'settings.html': 'Баптаулар' };

const App = {
  user: null, settings: {},
  applyTheme(t) { document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'; },
  async init(render) {
    const page = location.pathname.split('/').pop() || 'index.html';
    try { const me = await API.get('/api/auth/me'); App.user = me.user; App.settings = me.settings; }
    catch (e) { if (location.pathname.indexOf('login') < 0) { document.body.innerHTML = `<div class="state" style="padding:60px">⚠️ ${esc(e.message)}<br><br><a class="btn" href="/login.html">Кіру</a></div>`; } return; }
    App.applyTheme(App.settings.theme);
    const first = (App.user.full_name || '?').trim().split(/\s+/)[0];
    document.body.innerHTML = `<div class="layout"><aside class="sidebar" id="sidebar"><div class="brand"><span class="logo">${ico('leaf')}</span><div><div class="name">QARZHYM</div><small>Қаржы көмекшісі</small></div></div>
      <nav class="nav">${NAV.map(([h, l, i]) => `<a href="/${h}" class="${h === page ? 'active' : ''}" ${h === page ? 'aria-current="page"' : ''}><span class="ic">${ico(i)}</span>${l}${h === 'notifications.html' ? '<span class="nb" id="nb" hidden>0</span>' : ''}</a>`).join('')}</nav>
      <div class="side-foot"><div class="side-card"><span class="lf">${ico('leaf')}</span><div>Бүгінгі қадам — ертеңгі еркіндік!
        <svg class="side-spark" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" points="0,30 18,26 34,28 52,18 70,20 88,10 104,12 120,3"/></svg></div></div></div></aside>
      <div class="main"><header class="topbar"><button class="icon-btn burger" id="burger" aria-label="Мәзір">☰</button>
      <div><h2 id="tb-title">${esc(TITLES[page] || '')}</h2><p id="tb-sub"></p></div>
      <div class="tb-right"><form class="search" id="search-form" role="search">${ico('search', 'sm')}<input id="gsearch" type="search" placeholder="Іздеу..." aria-label="Іздеу"></form>
      <a class="icon-btn" href="/notifications.html" aria-label="Хабарландырулар">${ico('bell')}<span class="dotb" id="nd" hidden></span></a>
      <div class="user-menu"><button class="user-chip" id="user-btn" aria-haspopup="true" aria-expanded="false"><div class="avatar">${esc(first[0].toUpperCase())}</div><span class="un">${esc(first)}</span>${ico('chev', 'sm')}</button>
        <div class="dd" id="user-dd" hidden><a href="/profile.html">${ico('user', 'sm')}Профиль</a><a href="/settings.html">${ico('gear', 'sm')}Баптаулар</a>
        <button id="theme-btn" type="button">${ico('moon', 'sm')}Тақырыпты ауыстыру</button><button id="logout-btn" type="button">${ico('out', 'sm')}Шығу</button></div></div>
      </div></header><main class="content" id="content"></main></div></div>`;
    const sb = $('#sidebar');
    const toggle = (open) => { sb.classList.toggle('open', open); $('.scrim')?.remove(); if (open) { const s = document.createElement('div'); s.className = 'scrim'; s.onclick = () => toggle(false); document.body.append(s); } };
    $('#burger').onclick = () => toggle(!sb.classList.contains('open'));
    const dd = $('#user-dd'), ub = $('#user-btn');
    const setDd = (open) => { dd.hidden = !open; ub.setAttribute('aria-expanded', String(open)); };
    ub.onclick = (e) => { e.stopPropagation(); setDd(dd.hidden); };
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) setDd(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDd(false); });
    $('#search-form').onsubmit = (e) => { e.preventDefault(); const q = $('#gsearch').value.trim(); location.href = '/transactions.html' + (q ? `?q=${encodeURIComponent(q)}` : ''); };
    $('#theme-btn').onclick = async () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; App.applyTheme(t); App.settings.theme = t; try { await API.put('/api/settings', { theme: t }); } catch (e) { UI.toast(e.message, true); } };
    $('#logout-btn').onclick = async () => { try { await API.post('/api/auth/logout'); } catch { /* ignore */ } API.resetCsrf(); location.href = '/login.html'; };
    App.refreshBadge();
    await render($('#content'), page);
  },
  async refreshBadge() { try { const d = await API.get('/api/notifications'); const b = $('#nb'), n = $('#nd'); if (b) { b.textContent = d.unread; b.hidden = !d.unread; } if (n) n.hidden = !d.unread; } catch { /* ignore */ } },
};
