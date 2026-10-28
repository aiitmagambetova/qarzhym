App.init(async (el) => {
  let mode = 'month', from = '', to = ''; let charts = []; let last = null;
  function setRange() {
    const t = new Date(); const y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
    if (mode === 'day') from = to = ymd(t);
    else if (mode === 'week') { const off = (t.getDay() + 6) % 7; from = ymd(new Date(y, m, d - off)); to = ymd(new Date(y, m, d - off + 6)); }
    else if (mode === 'month') { from = ymd(new Date(y, m, 1)); to = ymd(new Date(y, m + 1, 0)); }
    else if (mode === 'year') { from = `${y}-01-01`; to = `${y}-12-31`; }
  }
  setRange();
  el.innerHTML = `<div class="page-head"><h1>Қаржылық есептер</h1><div class="quick no-print"><button class="btn ghost" id="print">🖨 Басып шығару</button><button class="btn ghost" id="csv">⬇ CSV жүктеу</button></div></div>
    <div class="card no-print"><div class="filters"><select id="mode"><option value="day">Күндік</option><option value="week">Апталық</option><option value="month" selected>Айлық</option><option value="year">Жылдық</option><option value="custom">Таңдалған мерзім</option></select>
    <input type="date" id="from" aria-label="Басы"><input type="date" id="to" aria-label="Соңы"><button class="btn sm" id="apply">Қолдану</button></div></div>
    <div id="body" class="mt"></div>`;
  const body = $('#body'); $('#from').value = from; $('#to').value = to;
  async function load() {
    UI.loading(body); charts.forEach((c) => c.destroy()); charts = [];
    try {
      const diffDays = (new Date(to) - new Date(from)) / 864e5; const group = diffDays > 62 ? 'month' : 'day';
      const [s, ie, cats, monthly, bud] = await Promise.all([API.get('/api/reports/summary', { from, to }), API.get('/api/reports/income-expenses', { from, to, group }),
        API.get('/api/reports/categories', { from, to }), API.get('/api/reports/monthly', { months: 12 }), API.get('/api/reports/budgets', { from, to })]);
      last = { s, cats };
      body.innerHTML = `<p class="note">Кезең: ${fmtDate(from)} — ${fmtDate(to)} (${s.days} күн)</p><div class="grid g4">
        ${[['Жалпы кіріс', s.income, 'in'], ['Жалпы шығыс', s.expense, 'out'], ['Таза айырма', s.net, s.net >= 0 ? 'in' : 'out'], ['Орташа күндік шығын', s.avg_daily_expense, 'out']].map(([l, v, c]) => `<div class="card stat"><div class="lbl">${l}</div><div class="val amt ${c}">${money(v)}</div></div>`).join('')}</div>
        <div class="grid g2 mt"><div class="card"><div class="lbl">Ең үлкен шығын</div><b>${s.largest_expense ? esc(s.largest_expense.title) + ' — ' + money(s.largest_expense.amount) + ' (' + fmtDate(s.largest_expense.tx_date) + ')' : '—'}</b></div>
        <div class="card"><div class="lbl">Ең қымбат санат</div><b>${s.top_category ? esc(s.top_category.name) + ' — ' + money(s.top_category.total) + ' (' + s.top_category.share + '%)' : '—'}</b></div></div>
        <div class="grid g2 mt"><div class="card"><h3>Кірістер мен шығыстар</h3><div class="chart-box"><canvas id="c1"></canvas></div></div><div class="card"><h3>Санат бойынша шығыстар</h3>${cats.length ? '<div class="chart-box"><canvas id="c2"></canvas></div>' : UI.empty('Бұл кезеңде шығыс жоқ')}</div>
        <div class="card"><h3>Айлық баланс динамикасы (12 ай)</h3><div class="chart-box"><canvas id="c3"></canvas></div></div><div class="card"><h3>Бюджет және нақты шығын</h3>${bud.length ? '<div class="chart-box"><canvas id="c4"></canvas></div>' : UI.empty('Бұл кезеңде бюджет жоқ')}</div></div>
        <div class="card mt"><h3>Санаттар бойынша кесте</h3>${cats.length ? cats.map((c) => `<div class="row"><span class="dot" style="background:${esc(c.color)}"></span><div class="grow">${esc(c.name)}</div><span>${c.share}%</span><b>${money(c.total)}</b></div>`).join('') : UI.empty('Деректер жоқ')}</div>`;
      if (!window.Chart) { UI.toast('Диаграмма кітапханасы жүктелмеді', true); return; }
      const tc = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
      const opt = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label || c.label}: ${money(c.parsed.y ?? c.parsed)}` } } }, scales: { x: { ticks: { color: tc } }, y: { beginAtZero: true, ticks: { color: tc, callback: (v) => money(v) } } } };
      const lab = (l) => (l.length === 7 ? `${MSHORT[+l.slice(5) - 1]} ${l.slice(2, 4)}` : fmtDate(l));
      charts.push(new Chart($('#c1'), { type: 'bar', data: { labels: ie.map((x) => lab(x.label)), datasets: [{ label: 'Кіріс', data: ie.map((x) => x.income), backgroundColor: '#2f9e74' }, { label: 'Шығыс', data: ie.map((x) => x.expense), backgroundColor: '#f4a261' }] }, options: opt }));
      if (cats.length) charts.push(new Chart($('#c2'), { type: 'doughnut', data: { labels: cats.map((c) => c.name), datasets: [{ data: cats.map((c) => c.total), backgroundColor: cats.map((c) => c.color), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tc } }, tooltip: { callbacks: { label: (c) => `${c.label}: ${money(c.parsed)}` } } } } }));
      charts.push(new Chart($('#c3'), { type: 'line', data: { labels: monthly.map((x) => lab(x.label)), datasets: [{ label: 'Баланс', data: monthly.map((x) => x.balance), borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,.12)', fill: true, tension: .3 }] }, options: opt }));
      if (bud.length) charts.push(new Chart($('#c4'), { type: 'bar', data: { labels: bud.map((b) => b.name), datasets: [{ label: 'Бюджет', data: bud.map((b) => b.amount), backgroundColor: '#4a90d9' }, { label: 'Нақты', data: bud.map((b) => b.spent), backgroundColor: '#f4a261' }] }, options: opt }));
    } catch (e) { UI.error(body, e.message, load); }
  }
  $('#mode').onchange = (e) => { mode = e.target.value; if (mode !== 'custom') { setRange(); $('#from').value = from; $('#to').value = to; load(); } };
  $('#apply').onclick = () => { from = $('#from').value; to = $('#to').value; if (!from || !to || to < from) return UI.toast('Күндерді дұрыс таңдаңыз', true); mode = 'custom'; $('#mode').value = 'custom'; load(); };
  $('#print').onclick = () => window.print();
  // CSV: формула инъекциясынан қорғау (=,+,-,@ белгілерімен басталатын ұяшықтарға ' қосылады)
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  $('#csv').onclick = () => { if (!last) return UI.toast('Алдымен есепті жүктеңіз', true);
    const rows = [['Санат', 'Сома (KZT)', 'Үлес (%)'], ...last.cats.map((c) => [c.name, c.total, c.share]), [], ['Кіріс', last.s.income], ['Шығыс', last.s.expense], ['Айырма', last.s.net]];
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `qarzhym-report-${from}_${to}.csv`; a.click(); URL.revokeObjectURL(a.href); };
  load();
});
