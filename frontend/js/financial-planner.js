App.init(async (el) => {
  el.innerHTML = `<div class="page-head"><h1>Қаржылық жоспар</h1><div class="quick"><button class="btn" id="ag">＋ Қаржылық мақсат</button><button class="btn orange" id="ap">＋ Жоспарланған операция</button></div></div>
    <p class="note">Бұл — ақпараттық құрал. Болжамдар болашақ нәтижені кепілдемейді; банктермен байланыс жоқ, ақша автоматты түрде аударылмайды. «Орындалды» деп белгілеу нақты транзакция жасамайды.</p>
    <div id="ov"></div><div class="grid g2 mt"><div class="card"><h3>Қаржылық мақсаттар</h3><div id="goals"></div></div><div class="card"><h3>Жоспарланған операциялар</h3><div id="pts"></div></div></div>`;
  const ST = { planned: 'Жоспарланған', done: 'Орындалды', cancelled: 'Бас тартылды' };
  async function load() {
    UI.loading($('#goals')); UI.loading($('#pts'));
    try {
      const [goals, pts, ov] = await Promise.all([API.get('/api/planner/goals'), API.get('/api/planner/transactions'), API.get('/api/planner/overview')]);
      const m = ov.month;
      $('#ov').innerHTML = `<div class="grid g3"><div class="card stat"><div class="lbl">Осы ай: жоспар (кіріс / шығыс)</div><div class="val" style="font-size:18px">${money(m.planned.income)} / ${money(m.planned.expense)}</div></div>
        <div class="card stat"><div class="lbl">Осы ай: нақты (кіріс / шығыс)</div><div class="val" style="font-size:18px">${money(m.actual.income)} / ${money(m.actual.expense)}</div></div>
        <div class="card stat"><div class="lbl">Алдағы 30 күн / мерзімі өткен</div><div class="val" style="font-size:18px">${ov.upcoming.length} / <span style="color:var(--danger)">${ov.overdue.length}</span></div></div></div>`;
      $('#goals').innerHTML = goals.length ? goals.map((g) => `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between"><b>${esc(g.title)}</b><span class="note">${g.progress}%</span></div>${UI.progress(g.progress)}
        <div class="note">${money(g.current_amount)} / ${money(g.target_amount)} · қалғаны ${money(g.remaining)}<br>${g.state === 'completed' ? '✅ Мақсатқа жетілді' : g.state === 'overdue' ? `⚠️ Мерзімі өтті — қалған сома: ${money(g.remaining)}` : g.state === 'no_date' ? 'Мақсатты күн көрсетілмеген' : `Болжамды айлық жарна: ${money(g.monthly_estimate)} (${g.months_left} ай)`}</div>
        <div style="margin-top:6px;display:flex;gap:6px"><button class="btn ghost sm" data-ge="${g.id}">Өзгерту</button><button class="btn ghost sm" data-gd="${g.id}">Жою</button></div></div>`).join('') : UI.empty('Мақсаттар жоқ');
      const all = [...ov.overdue.map((x) => ({ ...x, over: true })), ...pts.filter((p) => !ov.overdue.some((o) => o.id === p.id))];
      $('#pts').innerHTML = all.length ? all.map((p) => `<div class="row"><div class="grow"><div class="title">${esc(p.title)} ${p.over ? '<span class="tag bad">Мерзімі өтті</span>' : ''}</div><div class="meta">${fmtDate(p.planned_date)} · ${ST[p.status]} · ${p.type === 'income' ? 'Кіріс' : 'Шығыс'}</div></div><span class="amt ${p.type === 'income' ? 'in' : 'out'}">${money(p.amount)}</span>
        <div class="acts">${p.status === 'planned' ? `<button class="btn ghost sm" data-pdone="${p.id}">✓</button>` : ''}<button class="btn ghost sm" data-pe="${p.id}">Өзгерту</button><button class="btn ghost sm" data-pd="${p.id}">Жою</button></div></div>`).join('') : UI.empty('Жоспарланған операциялар жоқ');
      const q = (a, f) => el.querySelectorAll(`[${a}]`).forEach((b) => { b.onclick = () => f(+b.getAttribute(a)); });
      q('data-ge', (id) => goalForm(goals.find((x) => x.id === id)));
      q('data-gd', async (id) => { if (await UI.confirm('Мақсатты жою керек пе?')) { try { await API.del(`/api/planner/goals/${id}`); load(); } catch (e) { UI.toast(e.message, true); } } });
      q('data-pe', (id) => ptForm(pts.find((x) => x.id === id)));
      q('data-pd', async (id) => { if (await UI.confirm('Жоспарды жою керек пе?')) { try { await API.del(`/api/planner/transactions/${id}`); load(); } catch (e) { UI.toast(e.message, true); } } });
      q('data-pdone', async (id) => { const p = pts.find((x) => x.id === id); try { await API.put(`/api/planner/transactions/${id}`, { title: p.title, amount: p.amount, type: p.type, planned_date: p.planned_date, category_id: p.category_id, status: 'done' }); UI.toast('Орындалды деп белгіленді'); load(); } catch (e) { UI.toast(e.message, true); } });
    } catch (e) { UI.error($('#ov'), e.message, load); $('#goals').innerHTML = ''; $('#pts').innerHTML = ''; }
  }
  function goalForm(g = {}) {
    UI.form({ title: g.id ? 'Мақсатты өзгерту' : 'Жаңа қаржылық мақсат', fields: [{ name: 'title', label: 'Атауы', required: true, value: g.title, placeholder: 'Мысалы: Ай сайын ақша жинау' }, { name: 'target_amount', label: 'Мақсатты сома (₸)', type: 'number', required: true, value: g.target_amount },
      { name: 'current_amount', label: 'Қазір жиналған (₸)', type: 'number', value: g.current_amount }, { name: 'target_date', label: 'Мақсатты күн', type: 'date', value: g.target_date }, { name: 'description', label: 'Сипаттама', type: 'textarea', value: g.description }],
    onSubmit: async (d) => { g.id ? await API.put(`/api/planner/goals/${g.id}`, d) : await API.post('/api/planner/goals', d); UI.toast('Сақталды'); load(); } });
  }
  async function ptForm(p = {}) {
    const cats = await Forms.cats();
    const f = UI.form({ title: p.id ? 'Жоспарды өзгерту' : 'Жоспарланған операция', fields: [{ name: 'title', label: 'Атауы', required: true, value: p.title }, { name: 'type', label: 'Түрі', type: 'select', required: true, options: [['expense', 'Шығыс'], ['income', 'Кіріс']], value: p.type || 'expense' },
      { name: 'amount', label: 'Сома (₸)', type: 'number', required: true, value: p.amount }, { name: 'planned_date', label: 'Жоспарланған күн', type: 'date', required: true, value: p.planned_date || todayStr() },
      { name: 'category_id', label: 'Санат (міндетті емес)', type: 'select', options: [['', '—'], ...cats.map((c) => [c.id, `${c.name} (${c.type === 'income' ? 'кіріс' : 'шығыс'})`])], value: p.category_id || '' },
      { name: 'status', label: 'Күйі', type: 'select', options: Object.entries(ST), value: p.status || 'planned' }],
    onSubmit: async (d) => { p.id ? await API.put(`/api/planner/transactions/${p.id}`, d) : await API.post('/api/planner/transactions', d); UI.toast('Сақталды'); load(); } });
    return f;
  }
  $('#ag').onclick = () => goalForm(); $('#ap').onclick = () => ptForm();
  load();
});
