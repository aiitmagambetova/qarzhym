App.init(async (el) => {
  let type = '', meta = { colors: [], icons: [] };
  el.innerHTML = `<div class="page-head"><h1>Санаттар</h1><div class="quick"><select id="tp" style="width:auto"><option value="">Барлығы</option><option value="income">Кіріс</option><option value="expense">Шығыс</option></select><button class="btn" id="add">＋ Санат қосу</button></div></div><div id="list"></div>`;
  const list = $('#list');
  async function load() {
    UI.loading(list);
    try {
      const d = await API.get('/api/categories', { type }); meta = d;
      list.innerHTML = d.items.length ? `<div class="grid g3">${d.items.map((c) => `<div class="card"><div style="display:flex;align-items:center;gap:10px"><span class="pill" style="background:${esc(c.color)}33">${esc(c.icon || '🏷️')}</span><div class="grow"><b>${esc(c.name)}</b><div class="note">${c.type === 'income' ? 'Кіріс' : 'Шығыс'} · ${c.tx_count} транзакция · ${money(c.tx_total)}</div></div></div>
        <div style="display:flex;gap:6px;margin-top:10px"><button class="btn ghost sm" data-e="${c.id}">Өзгерту</button><button class="btn ghost sm" data-d="${c.id}">Жою</button></div></div>`).join('')}</div>` : `<div class="card">${UI.empty('Санаттар жоқ')}</div>`;
      list.querySelectorAll('[data-e]').forEach((b) => { b.onclick = () => form(d.items.find((x) => x.id === +b.dataset.e)); });
      list.querySelectorAll('[data-d]').forEach((b) => { b.onclick = async () => { if (await UI.confirm('Санатты жою керек пе?')) { try { await API.del(`/api/categories/${b.dataset.d}`); UI.toast('Жойылды'); load(); } catch (e) { UI.toast(e.message, true); } } }; });
    } catch (e) { UI.error(list, e.message, load); }
  }
  function form(c = {}) {
    const f = UI.form({ title: c.id ? 'Санатты өзгерту' : 'Жаңа санат', fields: [{ name: 'name', label: 'Атауы', required: true, value: c.name }, { name: 'type', label: 'Түрі', type: 'select', required: true, options: [['expense', 'Шығыс'], ['income', 'Кіріс']], value: c.type || 'expense' },
      { name: 'color', label: 'Түсі', type: 'select', required: true, options: meta.colors.map((x) => [x, x]), value: c.color || meta.colors[0] }, { name: 'icon', label: 'Белгіше', type: 'select', options: [['', '—'], ...meta.icons.map((x) => [x, x])], value: c.icon || '' }],
    onSubmit: async (d) => { c.id ? await API.put(`/api/categories/${c.id}`, d) : await API.post('/api/categories', d); UI.toast('Сақталды'); load(); } });
    const sw = f.color; const paint = () => { sw.style.borderLeft = `10px solid ${sw.value}`; }; sw.onchange = paint; paint();
  }
  $('#tp').onchange = (e) => { type = e.target.value; load(); }; $('#add').onclick = () => form();
  load();
});
