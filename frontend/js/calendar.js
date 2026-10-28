App.init(async (el) => {
  let view = 'month', cur = new Date(); cur.setDate(1); let anchor = new Date();
  el.innerHTML = `<div class="page-head"><h1>Қаржылық күнтізбе</h1><div class="quick"><div class="tabs"><button data-v="month" class="on">Ай</button><button data-v="week">Апта</button></div>
    <button class="btn ghost sm" id="prev">‹</button><b id="lbl" style="min-width:140px;text-align:center"></b><button class="btn ghost sm" id="next">›</button><button class="btn ghost sm" id="today">Бүгін</button><button class="btn" id="add">＋ Оқиға</button></div></div>
    <div class="card"><div id="grid"></div><p class="note">Жасыл — кіріс, қызыл — шығыс (нақты), сарғыш — жоспарланған төлем (шығынға есептелмейді), көк — жеке оқиға.</p></div>`;
  const grid = $('#grid');
  function bounds() {
    if (view === 'month') { const f = new Date(cur.getFullYear(), cur.getMonth(), 1); const off = (f.getDay() + 6) % 7; const s = new Date(f); s.setDate(1 - off); const e = new Date(s); e.setDate(s.getDate() + 41); return [s, e]; }
    const off = (anchor.getDay() + 6) % 7; const s = new Date(anchor); s.setDate(anchor.getDate() - off); const e = new Date(s); e.setDate(s.getDate() + 6); return [s, e];
  }
  async function load() {
    const [s, e] = bounds();
    $('#lbl').textContent = view === 'month' ? monthLabel(ymd(cur).slice(0, 7)) : `${fmtDate(ymd(s))} – ${fmtDate(ymd(e))}`;
    UI.loading(grid);
    try {
      const d = await API.get('/api/calendar', { from: ymd(s), to: ymd(e) });
      const by = {}; const push = (k, o) => { (by[k] = by[k] || []).push(o); };
      d.transactions.forEach((t) => push(t.tx_date, { c: t.type === 'income' ? 'in' : 'out', t: `${t.type === 'income' ? '+' : '−'}${money(t.amount)} ${t.title}`, kind: 'tx', o: t }));
      d.planned.forEach((p) => push(p.planned_date, { c: 'plan', t: `⏳ ${p.title} ${money(p.amount)}`, kind: 'pl', o: p }));
      d.events.forEach((v) => push(v.event_date, { c: 'evt', t: `📌 ${v.title}`, kind: 'ev', o: v }));
      let h = WDAYS.map((w) => `<div class="h">${w}</div>`).join(''); const n = view === 'month' ? 42 : 7; const ts = todayStr();
      for (let i = 0; i < n; i++) {
        const dt = new Date(s); dt.setDate(s.getDate() + i); const k = ymd(dt); const evs = by[k] || [];
        h += `<div class="d ${view === 'month' && dt.getMonth() !== cur.getMonth() ? 'other' : ''} ${k === ts ? 'today' : ''}" data-d="${k}"><b>${dt.getDate()}</b>${evs.length ? `<span class="cnt">● ${evs.length}</span>` : ''}${evs.slice(0, view === 'week' ? 20 : 3).map((x, j) => `<div class="ev ${x.c}" data-k="${k}" data-j="${j}">${esc(x.t)}</div>`).join('')}${evs.length > 3 && view === 'month' ? `<div class="note">+${evs.length - 3}</div>` : ''}</div>`;
      }
      grid.className = 'cal' + (view === 'week' ? ' week' : ''); grid.innerHTML = h;
      grid.querySelectorAll('.d').forEach((c) => { c.onclick = (ev) => { const x = ev.target.closest('.ev'); if (x) { ev.stopPropagation(); return detail(by[x.dataset.k][+x.dataset.j]); } day(c.dataset.d, by[c.dataset.d] || []); }; });
    } catch (e) { UI.error(grid, e.message, load); }
  }
  function detail(x) {
    const o = x.o; const box = document.createElement('div');
    if (x.kind === 'ev') {
      box.innerHTML = `<p><b>${esc(o.title)}</b><br>${EVENT_TYPES[o.event_type]} · ${fmtDate(o.event_date)}${o.amount !== null ? '<br>Сома: ' + money(o.amount) : ''}${o.description ? '<br>' + esc(o.description) : ''}</p><div class="acts"><button class="btn ghost" data-x="e">Өзгерту</button><button class="btn danger" data-x="d">Жою</button></div>`;
      const close = UI.modal('Оқиға мәліметі', box);
      box.querySelector('[data-x=e]').onclick = () => { close(); eventForm(o); };
      box.querySelector('[data-x=d]').onclick = async () => { close(); if (await UI.confirm('Оқиғаны жою керек пе?')) { try { await API.del(`/api/calendar/${o.id}`); UI.toast('Жойылды'); load(); } catch (e) { UI.toast(e.message, true); } } };
    } else {
      box.innerHTML = `<p><b>${esc(o.title)}</b><br>${money(o.amount)} · ${o.type === 'income' ? 'Кіріс' : 'Шығыс'}<br>${x.kind === 'pl' ? 'Жоспарланған (нақты шығынға есептелмейді) · ' + fmtDate(o.planned_date) : 'Нақты транзакция · ' + fmtDate(o.tx_date)}</p><div class="acts"><button class="btn ghost" data-x="c">Жабу</button></div>`;
      const close = UI.modal('Мәлімет', box); box.querySelector('[data-x=c]').onclick = close;
    }
  }
  function day(k, evs) {
    const box = document.createElement('div');
    box.innerHTML = `<div>${evs.length ? evs.map((x, i) => `<div class="row"><div class="grow">${esc(x.t)}</div><button class="btn ghost sm" data-i="${i}">Көру</button></div>`).join('') : '<div class="empty">Бұл күні жазба жоқ</div>'}</div><div class="acts"><button class="btn" data-x="a">＋ Оқиға қосу</button></div>`;
    const close = UI.modal(fmtDate(k), box);
    box.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => { close(); detail(evs[+b.dataset.i]); }; });
    box.querySelector('[data-x=a]').onclick = () => { close(); eventForm({ event_date: k }); };
  }
  function eventForm(ev = {}) {
    UI.form({ title: ev.id ? 'Оқиғаны өзгерту' : 'Жаңа оқиға', fields: [
      { name: 'title', label: 'Атауы', required: true, value: ev.title }, { name: 'event_type', label: 'Түрі', type: 'select', options: Object.entries(EVENT_TYPES), value: ev.event_type || 'other', required: true },
      { name: 'event_date', label: 'Күні', type: 'date', required: true, value: ev.event_date }, { name: 'amount', label: 'Сома (₸, міндетті емес)', type: 'number', value: ev.amount },
      { name: 'description', label: 'Сипаттама', type: 'textarea', value: ev.description }],
    onSubmit: async (d) => { ev.id ? await API.put(`/api/calendar/${ev.id}`, d) : await API.post('/api/calendar', d); UI.toast('Сақталды'); load(); } });
  }
  const move = (k) => { if (view === 'month') cur.setMonth(cur.getMonth() + k); else anchor.setDate(anchor.getDate() + 7 * k); load(); };
  $('#prev').onclick = () => move(-1); $('#next').onclick = () => move(1);
  $('#today').onclick = () => { cur = new Date(); cur.setDate(1); anchor = new Date(); load(); };
  $('#add').onclick = () => eventForm({ event_date: todayStr() });
  el.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => { view = b.dataset.v; el.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  load();
});
