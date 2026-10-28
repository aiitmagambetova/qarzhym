// Басты бет (дашборд): статистика карточкалары, диаграммалар, соңғы операциялар, жинақ мақсаты
App.init(async (el) => {
  let month = todayStr().slice(0, 7), range = 'month'; const MONTHS_SHOWN = 10; let charts = {};
  const PALETTE = ['#8db63c', '#4ddc3d', '#8ee8a0', '#2fd3a2', '#f5c542', '#3aa6a0', '#b6e35a', '#6fb87a'];
  const first = App.user.full_name.trim().split(/\s+/)[0];
  $('#tb-title').textContent = `Сәлем, ${first}!`;
  $('#tb-sub').textContent = 'Қаржылық жағдайыңызға шолу';

  async function load() {
    UI.loading(el);
    try { render(await API.get('/api/dashboard', { month, months: MONTHS_SHOWN, range })); } catch (e) { UI.error(el, e.message, load); }
  }
  const hexA = (hex, a) => { const h = hex.replace('#', ''); const v = h.length === 3 ? h.replace(/./g, '$&$&') : h; return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`; };
  function spark(values, color) {
    const w = 100, h = 30; const max = Math.max(...values), min = Math.min(...values); const span = max - min || 1;
    const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * w : 0, values.every((x) => x === values[0]) ? h / 2 : h - 3 - ((v - min) / span) * (h - 6)]);
    const line = pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,${h} ${line} ${w},${h}" fill="${hexA(color, 0.14)}"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function change(p, goodWhenDown) {
    if (p === null || p === undefined) return '<span>Өткен ай деректері жоқ</span>';
    const up = p > 0, zero = p === 0; const good = zero ? true : goodWhenDown ? !up : up;
    return `<span class="${good ? 'up' : 'down'}">${zero ? '•' : up ? '↑' : '↓'} ${p > 0 ? '+' : ''}${p}%</span><span>өткен аймен салыстырғанда</span>`;
  }
  const lbl = (r) => (range === 'month' ? MSHORT[+r.label.slice(5) - 1] : range === 'week' ? WDAYS[(new Date(r.label + 'T00:00:00').getDay() + 6) % 7] : r.label);

  function render(d) {
    Object.values(charts).forEach((c) => c.destroy()); charts = {};
    const s = d.summary, m = d.month_stats; const goal = d.goals[0];
    let cum = 0; const balSeries = d.chart.map((x) => (cum += x.income - x.expense));
    const catTotal = d.categories.reduce((a, c) => a + c.total, 0);
    const goalBox = (g) => `<div class="goal-box"><div class="goal-top"><div class="goal-ico">${ico('plane', 'lg')}</div>
      <div><div class="t">${esc(g.title)}</div><div class="s">${esc(g.description || (g.target_date ? 'Мақсатты күн: ' + fmtDate(g.target_date) : 'Мерзімі белгіленбеген'))}</div></div>
      <div class="r">${money(g.current_amount)} / ${money(g.target_amount)}</div></div>
      <div class="goal-pct">${UI.progress(g.progress)}<b>${g.progress}%</b></div></div>`;

    el.innerHTML = `
    <div class="dash-head no-print">
      <button class="btn sm" id="q-in">${ico('plus', 'sm')} Кіріс</button><button class="btn orange sm" id="q-out">${ico('minus', 'sm')} Шығыс</button><button class="btn ghost sm" id="q-bud">Бюджет құру</button>
      <label class="datebox" aria-label="Ай">${ico('calendar', 'sm')}<input type="month" id="month" value="${month}"></label>
    </div>
    <div class="grid g4">
      <div class="card stat-card"><div class="lbl"><span class="ring">${ico('wallet')}</span>Жалпы баланс</div><div class="val">${money(s.balance)}</div>${spark(balSeries, '#6fe03a')}
        <div class="cmp">${change(m.balance_change_percent, false)}</div></div>
      <div class="card stat-card"><div class="lbl"><span class="ring">${ico('plus')}</span>Жалпы кіріс</div><div class="val">${money(s.income)}</div>${spark(d.chart.map((x) => x.income), '#6fe03a')}
        <div class="cmp">${change(m.income_change_percent, false)}</div></div>
      <div class="card stat-card"><div class="lbl"><span class="ring y">${ico('minus')}</span>Жалпы шығыс</div><div class="val">${money(s.expense)}</div>${spark(d.chart.map((x) => x.expense), '#f5c542')}
        <div class="cmp">${change(m.expense_change_percent, true)}</div></div>
      <div class="card stat-card"><div class="lbl"><span class="ring">${ico('target')}</span>Жинақ мақсаты</div>
        ${goal ? `<div class="val">${goal.progress}%</div>${UI.progress(goal.progress)}<div class="cmp"><span>${money(goal.current_amount)} / ${money(goal.target_amount)}</span></div>`
          : `<div class="val">${money(s.savings)}</div><div class="cmp"><span>Мақсат әлі жоқ — </span><a class="more" href="#" id="q-sav0">қосу</a></div>`}</div>
    </div>

    <div class="dash-grid">
      <div class="card"><div class="card-head"><h3><span class="hi">${ico('trend')}</span>Кіріс пен шығыс</h3>
        <div class="seg" role="tablist">${[['week', 'Апта'], ['month', 'Ай'], ['year', 'Жыл']].map(([k, l]) => `<button type="button" data-r="${k}" class="${k === range ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="chart-box"><canvas id="c-line" aria-label="Кіріс пен шығыс диаграммасы"></canvas></div></div>
      <div class="card"><div class="card-head"><h3><span class="hi">${ico('pie')}</span>Шығыс санаттары</h3><a class="more" href="/reports.html">Толығырақ ${ico('arrow', 'sm')}</a></div>
        ${d.categories.length ? `<div class="donut-wrap"><div class="donut"><canvas id="c-pie"></canvas><div class="mid"><b>${money(catTotal)}</b><span>барлық шығыс</span></div></div>
          <div class="cat-list">${d.categories.slice(0, 5).map((c, i) => `<div class="cat-item"><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><span class="nm">${esc(c.name)}</span><span class="pc">${c.share}%</span><span class="sm">${money(c.total)}</span></div>`).join('')}</div></div>
          <div class="note" style="margin-top:6px">${monthLabel(month)}</div>` : UI.empty('Бұл айда шығыс жоқ')}</div>
    </div>

    <div class="dash-grid">
      <div class="card"><div class="card-head"><h3><span class="hi">${ico('clock')}</span>Соңғы операциялар</h3><a class="more" href="/transactions.html">Барлығы ${ico('arrow', 'sm')}</a></div>
        ${d.recent.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Күні</th><th>Сипаттама</th><th class="hide-s">Санат</th><th>Сома</th><th>Түрі</th><th></th></tr></thead><tbody>
          ${d.recent.slice(0, 5).map((t) => { const inc = t.type === 'income'; return `<tr><td>${fmtDate(t.tx_date)}</td>
            <td><span class="who"><span class="cico" style="background:${esc(t.category_color)}33">${esc(t.category_icon || '•')}</span>${esc(t.title)}</span></td><td class="hide-s">${esc(t.category_name)}</td>
            <td><span class="amt ${inc ? 'in' : 'out'}">${inc ? '+' : '−'} ${money(t.amount)}</span></td><td><span class="badge-t ${inc ? 'in' : 'out'}">${inc ? 'Кіріс' : 'Шығыс'}</span></td>
            <td><a class="dots" href="/transactions.html?q=${encodeURIComponent(t.title)}" aria-label="Толығырақ">⋮</a></td></tr>`; }).join('')}</tbody></table></div>` : UI.empty('Транзакциялар әлі жоқ')}</div>
      <div class="card"><div class="card-head"><h3><span class="hi">${ico('target')}</span>Жинақ мақсаты</h3><a class="more" href="/savings.html">Толығырақ ${ico('arrow', 'sm')}</a></div>
        ${d.goals.length ? d.goals.slice(0, 2).map(goalBox).join('') : UI.empty('Жинақ мақсаттары жоқ')}
        <button class="btn outline" id="q-sav">${ico('plus', 'sm')} Жаңа мақсат қосу</button>
        <div class="tip"><span class="lb">${ico('bulb', 'lg')}</span><div><b>Жақсы әдеттер — үлкен мақсаттарға жетелейді!</b><span>Күн сайын 1 000 ₸ жинаңыз және арманыңызға жақындай беріңіз.</span></div></div></div>
    </div>

    <div class="grid g2 analytics">
      <div class="card"><div class="card-head"><h3>Бюджет прогресі</h3><a class="more" href="/budgets.html">Барлығы ${ico('arrow', 'sm')}</a></div>
        ${d.budgets.length ? d.budgets.slice(0, 4).map((b) => `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between"><b>${esc(b.icon || '')} ${esc(b.name)}</b><span class="note">${b.percent}%</span></div>
          <div class="note">${money(b.spent)} / ${money(b.amount)} · қалғаны ${money(b.remaining)}</div>${UI.progress(b.percent, b.status)}</div>`).join('') : UI.empty('Осы айға бюджет жоқ')}</div>
      <div class="card"><div class="card-head"><h3>Қаржылық талдау</h3></div>
        <div class="row"><div class="grow">Осы айдағы шығыс</div><b>${money(m.expense)}</b></div>
        <div class="row"><div class="grow">Ең көп шығын санаты</div><b>${d.largest_category ? esc(d.largest_category.name) + ' (' + d.largest_category.share + '%)' : '—'}</b></div>
        <div class="row"><div class="grow">Өткен айдан айырмасы</div><b class="${m.expense_diff > 0 ? 'amt out' : 'amt in'}">${m.expense_diff > 0 ? '+' : ''}${money(m.expense_diff)}${m.expense_change_percent !== null ? ` (${m.expense_change_percent > 0 ? '+' : ''}${m.expense_change_percent}%)` : ''}</b></div>
        <div class="row"><div class="grow">Лимитке жақындаған бюджеттер</div><b>${d.near_limit.length}</b></div>
        ${d.near_limit.map((b) => `<div class="note">• ${esc(b.name)}: ${b.percent}%</div>`).join('')}</div>
    </div>`;

    $('#month').onchange = (e) => { if (e.target.value) { month = e.target.value; load(); } };
    el.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => { if (b.dataset.r !== range) { range = b.dataset.r; load(); } }; });
    $('#q-in').onclick = () => Forms.transaction(load, {}, 'income'); $('#q-out').onclick = () => Forms.transaction(load, {}, 'expense');
    $('#q-bud').onclick = () => Forms.budget(load); $('#q-sav').onclick = () => Forms.saving(load);
    const s0 = $('#q-sav0'); if (s0) s0.onclick = (e) => { e.preventDefault(); Forms.saving(load); };

    if (window.Chart) {
      const css = getComputedStyle(document.documentElement); const tc = css.getPropertyValue('--muted').trim(); const gc = css.getPropertyValue('--line').trim();
      const accent = css.getPropertyValue('--accent').trim() || '#6fe03a'; const yellow = '#f5c542';
      const fill = (hex) => (c) => { const a = c.chart.chartArea; if (!a) return hexA(hex, 0.15); const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, hexA(hex, 0.35)); g.addColorStop(1, hexA(hex, 0)); return g; };
      const ds = (label, key, hex) => ({ label, data: d.chart.map((x) => x[key]), borderColor: hex, backgroundColor: fill(hex), fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3.5, pointHoverRadius: 5, pointBackgroundColor: hex, pointBorderColor: hex });
      charts.line = new Chart($('#c-line'), { type: 'line', data: { labels: d.chart.map(lbl), datasets: [ds('Кіріс', 'income', accent), ds('Шығыс', 'expense', yellow)] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top', align: 'end', labels: { color: tc, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } },
          scales: { x: { ticks: { color: tc }, grid: { color: gc } }, y: { beginAtZero: true, ticks: { color: tc, callback: (v) => money(v) }, grid: { color: gc } } } } });
      if (d.categories.length) charts.pie = new Chart($('#c-pie'), { type: 'doughnut', data: { labels: d.categories.map((c) => c.name), datasets: [{ data: d.categories.map((c) => c.total), backgroundColor: d.categories.map((c, i) => PALETTE[i % PALETTE.length]), borderWidth: 3, borderColor: css.getPropertyValue('--card').trim() || '#07160f' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${money(c.parsed)}` } } } } });
    } else UI.toast('Диаграмма кітапханасы жүктелмеді (интернетті тексеріңіз)', true);
  }
  load();
});
