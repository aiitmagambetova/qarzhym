App.init(async (el) => {
  let status = '', sort = 'created';
  el.innerHTML = `<div class="page-head"><h1>Жинақтар</h1><div class="quick"><select id="st" style="width:auto"><option value="">Барлық күйлер</option><option value="active">Белсенді</option><option value="completed">Аяқталған</option></select>
    <select id="so" style="width:auto"><option value="created">Жаңалары алдымен</option><option value="target_date">Мақсатты күн бойынша</option></select><button class="btn" id="add">＋ Мақсат қосу</button></div></div>
    <p class="note">Жинаққа салынған ақша шығыс ретінде есептелмейді: «Жалпы баланс» = бастапқы баланс + кіріс − шығыс, ал жинақ сомасы бөлек көрсетіледі.</p><div id="list"></div>`;
  const list = $('#list');
  async function load() {
    UI.loading(list);
    try {
      const items = await API.get('/api/savings', { status, sort });
      list.innerHTML = items.length ? `<div class="grid g3">${items.map((g) => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(g.title)}</b>${g.status === 'completed' ? '<span class="tag good">Аяқталған</span>' : g.state === 'overdue' ? '<span class="tag bad">Мерзімі өтті</span>' : '<span class="tag">Белсенді</span>'}</div>
        ${g.description ? `<div class="note">${esc(g.description)}</div>` : ''}<div style="margin:10px 0 6px;display:flex;justify-content:space-between"><span>${money(g.current_amount)} / ${money(g.target_amount)}</span><b>${g.progress}%</b></div>${UI.progress(g.progress)}
        <div class="note" style="margin-top:6px">Қалғаны: ${money(g.remaining)}<br>Мақсатты күн: ${fmtDate(g.target_date)}${g.state === 'active' ? `<br>Болжамды айлық жарна: ${money(g.monthly_estimate)} (${g.months_left} ай)` : ''}</div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-a="dep" data-id="${g.id}">＋ Салу</button><button class="btn ghost sm" data-a="wd" data-id="${g.id}">Алу</button><button class="btn ghost sm" data-a="hist" data-id="${g.id}">Тарих</button><button class="btn ghost sm" data-a="edit" data-id="${g.id}">Өзгерту</button><button class="btn ghost sm" data-a="del" data-id="${g.id}">Жою</button></div></div>`).join('')}</div>` : `<div class="card">${UI.empty('Жинақ мақсаттары жоқ', '')}</div>`;
      list.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => act(b.dataset.a, items.find((i) => i.id === +b.dataset.id)); });
    } catch (e) { UI.error(list, e.message, load); }
  }
  async function act(a, g) {
    if (a === 'edit') return Forms.saving(load, g);
    if (a === 'del') { if (await UI.confirm(`«${g.title}» мақсатын және оның жарна тарихын жою керек пе?`)) { try { await API.del(`/api/savings/${g.id}`); UI.toast('Жойылды'); load(); } catch (e) { UI.toast(e.message, true); } } return; }
    if (a === 'hist') {
      const box = document.createElement('div'); UI.loading(box); UI.modal('Жарналар тарихы', box);
      try { const h = await API.get(`/api/savings/${g.id}/contributions`); box.innerHTML = h.length ? h.map((x) => `<div class="row"><div class="grow">${x.type === 'deposit' ? 'Салынды' : 'Алынды'}<div class="meta">${esc(x.created_at)}${x.note ? ' · ' + esc(x.note) : ''}</div></div><b class="amt ${x.type === 'deposit' ? 'in' : 'out'}">${x.type === 'deposit' ? '+' : '−'}${money(x.amount)}</b></div>`).join('') : UI.empty('Жазба жоқ'); } catch (e) { UI.error(box, e.message); }
      return;
    }
    const type = a === 'dep' ? 'deposit' : 'withdrawal';
    UI.form({ title: type === 'deposit' ? 'Жинаққа ақша салу' : 'Жинақтан ақша алу', fields: [{ name: 'amount', label: 'Сома (₸)', type: 'number', required: true }, { name: 'note', label: 'Ескертпе' }],
      onSubmit: async (d) => { await API.post(`/api/savings/${g.id}/contributions`, { ...d, type }); UI.toast('Сақталды'); load(); } });
  }
  $('#st').onchange = (e) => { status = e.target.value; load(); }; $('#so').onchange = (e) => { sort = e.target.value; load(); }; $('#add').onclick = () => Forms.saving(load);
  load();
});
