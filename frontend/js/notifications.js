App.init(async (el) => {
  el.innerHTML = `<div class="page-head"><h1>Хабарландырулар</h1><button class="btn ghost" id="all">Барлығын оқылды деп белгілеу</button></div><div class="card" id="list"></div>`;
  const list = $('#list'); const ICON = { budget_warning: '⚠️', budget_exceeded: '🚨', payment_due: '⏰', payment_overdue: '❗', goal_progress: '🎯' };
  async function load() {
    UI.loading(list);
    try {
      const d = await API.get('/api/notifications'); App.refreshBadge();
      list.innerHTML = d.items.length ? d.items.map((n) => `<div class="row" style="${n.is_read ? 'opacity:.65' : ''}"><span class="pill" style="background:var(--line)">${ICON[n.type]}</span><div class="grow"><div class="title">${esc(n.title)} ${n.is_read ? '' : '<span class="tag warn">Жаңа</span>'}</div><div class="meta">${esc(n.message)}</div></div>
        <div class="acts">${n.link ? `<button class="btn ghost sm" data-o="${n.id}" data-l="${esc(n.link)}">Ашу</button>` : ''}${n.is_read ? '' : `<button class="btn ghost sm" data-r="${n.id}">Оқылды</button>`}<button class="btn ghost sm" data-x="${n.id}">✕</button></div></div>`).join('') : UI.empty('Жаңа хабарландыру жоқ');
      list.querySelectorAll('[data-r]').forEach((b) => { b.onclick = async () => { try { await API.patch(`/api/notifications/${b.dataset.r}/read`); load(); } catch (e) { UI.toast(e.message, true); } }; });
      list.querySelectorAll('[data-x]').forEach((b) => { b.onclick = async () => { try { await API.del(`/api/notifications/${b.dataset.x}`); load(); } catch (e) { UI.toast(e.message, true); } }; });
      list.querySelectorAll('[data-o]').forEach((b) => { b.onclick = async () => { try { await API.patch(`/api/notifications/${b.dataset.o}/read`); } catch { /* ignore */ } location.href = '/' + b.dataset.l; }; });
    } catch (e) { UI.error(list, e.message, load); }
  }
  $('#all').onclick = async () => { try { await API.patch('/api/notifications/read-all'); load(); } catch (e) { UI.toast(e.message, true); } };
  load();
});
