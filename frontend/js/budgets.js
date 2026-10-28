App.init(async (el) => {
  let period = '';
  el.innerHTML = `<div class="page-head"><h1>Бюджет</h1><div class="quick"><select id="per" style="width:auto"><option value="">Барлық мерзімдер</option>${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><button class="btn" id="add">＋ Бюджет құру</button></div></div><div id="list"></div>`;
  const list = $('#list');
  async function load() {
    UI.loading(list);
    try {
      const items = await API.get('/api/budgets', { period });
      if (!items.length) { list.innerHTML = `<div class="card">${UI.empty('Бюджет әлі құрылмаған')}</div>`; return; }
      const planned = items.reduce((s, b) => s + b.amount, 0), spent = items.reduce((s, b) => s + b.spent, 0);
      list.innerHTML = `<div class="card" style="margin-bottom:16px"><b>Жоспар және нақты:</b> жоспарланған ${money(planned)} · нақты шығын ${money(spent)}</div><div class="grid g3">${items.map((b) => `<div class="card">
        <div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(b.icon || '')} ${esc(b.name)}</b>${b.status === 'exceeded' ? '<span class="tag bad">Асып кетті</span>' : b.status === 'warning' ? '<span class="tag warn">Лимитке жақын</span>' : '<span class="tag good">Қалыпты</span>'}</div>
        <div class="note">${esc(b.category_name)} · ${PERIODS[b.period]}<br>${fmtDate(b.start_date)} — ${fmtDate(b.end_date)}</div>
        <div style="margin:12px 0 6px;display:flex;justify-content:space-between"><span>${money(b.spent)} / ${money(b.amount)}</span><b>${b.percent}%</b></div>${UI.progress(b.percent, b.status)}
        <div class="note" style="margin-top:6px">${b.remaining >= 0 ? 'Қалғаны: ' + money(b.remaining) : 'Асып кетті: ' + money(-b.remaining)}</div>
        ${b.spent === 0 ? '<div class="note">Бұл мерзімде шығын жоқ</div>' : ''}
        <div class="acts" style="display:flex;gap:6px;margin-top:10px"><button class="btn ghost sm" data-e="${b.id}">Өзгерту</button><button class="btn ghost sm" data-d="${b.id}">Жою</button></div></div>`).join('')}</div>`;
      list.querySelectorAll('[data-e]').forEach((x) => { x.onclick = () => Forms.budget(load, items.find((i) => i.id === +x.dataset.e)); });
      list.querySelectorAll('[data-d]').forEach((x) => { x.onclick = async () => { if (await UI.confirm('Бюджетті жою керек пе?')) { try { await API.del(`/api/budgets/${x.dataset.d}`); UI.toast('Жойылды'); load(); } catch (e) { UI.toast(e.message, true); } } }; });
    } catch (e) { UI.error(list, e.message, load); }
  }
  $('#per').onchange = (e) => { period = e.target.value; load(); }; $('#add').onclick = () => Forms.budget(load);
  load();
});
