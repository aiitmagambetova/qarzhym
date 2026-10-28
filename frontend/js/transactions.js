App.init(async (el) => {
  let cats = []; const F = { q: '', type: '', category_id: '', from: '', to: '', sort: 'date', order: 'desc' };
  try { cats = await Forms.cats(); } catch (e) { UI.error(el, e.message); return; }
  el.innerHTML = `<div class="page-head"><h1>Транзакциялар</h1><button class="btn" id="add">＋ Транзакция қосу</button></div>
    <div class="grid g3" id="tot"></div>
    <div class="card mt"><div class="filters no-print">
      <input id="q" type="search" placeholder="Атауы бойынша іздеу" aria-label="Іздеу">
      <select id="type"><option value="">Барлық түрлер</option><option value="income">Кіріс</option><option value="expense">Шығыс</option></select>
      <select id="cat"><option value="">Барлық санаттар</option>${cats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <input id="from" type="date" aria-label="Басталу күні"><input id="to" type="date" aria-label="Аяқталу күні">
      <select id="sort"><option value="date:desc">Күні: жаңадан ескіге</option><option value="date:asc">Күні: ескіден жаңаға</option><option value="amount:desc">Сома: үлкеннен кішіге</option><option value="amount:asc">Сома: кішіден үлкенге</option></select>
      <button class="btn ghost sm" id="month-btn">Осы ай</button><button class="btn ghost sm" id="reset">Тазалау</button></div>
    <div id="list"></div></div>`;
  const list = $('#list');
  const pq = new URLSearchParams(location.search).get('q'); if (pq) { F.q = pq; $('#q').value = pq; }
  async function load() {
    UI.loading(list);
    try {
      const d = await API.get('/api/transactions', F);
      $('#tot').innerHTML = [['Кіріс', d.totals.income, 'in'], ['Шығыс', d.totals.expense, 'out'], ['Айырма (кіріс − шығыс)', d.totals.net, d.totals.net >= 0 ? 'in' : 'out']].map(([l, v, c]) => `<div class="card stat"><div class="lbl">${l}</div><div class="val amt ${c}">${money(v)}</div><div class="sub">Сүзгіге сәйкес ${d.totals.count} жазба</div></div>`).join('');
      list.innerHTML = d.items.length ? d.items.map((t) => `<div class="row"><span class="pill" style="background:${esc(t.category_color)}33">${esc(t.category_icon || '•')}</span>
        <div class="grow"><div class="title">${esc(t.title)}</div><div class="meta">${esc(t.category_name)} · ${fmtDate(t.tx_date)}${t.payment_method ? ' · ' + esc(t.payment_method) : ''}</div>${t.description ? `<div class="meta">${esc(t.description)}</div>` : ''}</div>
        <span class="amt ${t.type === 'income' ? 'in' : 'out'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</span>
        <div class="acts no-print"><button class="btn ghost sm" data-e="${t.id}">Өзгерту</button><button class="btn ghost sm" data-d="${t.id}">Жою</button></div></div>`).join('') : UI.empty('Транзакциялар табылмады');
      list.querySelectorAll('[data-e]').forEach((b) => { b.onclick = () => Forms.transaction(load, d.items.find((x) => x.id === +b.dataset.e)); });
      list.querySelectorAll('[data-d]').forEach((b) => { b.onclick = async () => { if (await UI.confirm('Бұл транзакцияны жою керек пе?')) { try { await API.del(`/api/transactions/${b.dataset.d}`); UI.toast('Жойылды'); load(); } catch (e) { UI.toast(e.message, true); } } }; });
    } catch (e) { UI.error(list, e.message, load); }
  }
  let tm; $('#q').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { F.q = e.target.value; load(); }, 300); };
  $('#type').onchange = (e) => { F.type = e.target.value; load(); }; $('#cat').onchange = (e) => { F.category_id = e.target.value; load(); };
  $('#from').onchange = (e) => { F.from = e.target.value; load(); }; $('#to').onchange = (e) => { F.to = e.target.value; load(); };
  $('#sort').onchange = (e) => { [F.sort, F.order] = e.target.value.split(':'); load(); };
  $('#month-btn').onclick = () => { const n = new Date(); const y = n.getFullYear(), m = n.getMonth(); F.from = ymd(new Date(y, m, 1)); F.to = ymd(new Date(y, m + 1, 0)); $('#from').value = F.from; $('#to').value = F.to; load(); };
  $('#reset').onclick = () => { Object.assign(F, { q: '', type: '', category_id: '', from: '', to: '', sort: 'date', order: 'desc' }); ['q', 'type', 'cat', 'from', 'to'].forEach((i) => { $('#' + i).value = ''; }); $('#sort').value = 'date:desc'; load(); };
  $('#add').onclick = () => Forms.transaction(load);
  load();
});
