App.init(async (el, page) => {
  const isSettings = page === 'settings.html'; const S = App.settings;
  const chk = (id, label, v) => `<label style="display:flex;gap:10px;align-items:center;color:var(--text);margin-bottom:10px"><input type="checkbox" id="${id}" style="width:auto;min-height:0" ${v ? 'checked' : ''}> ${label}</label>`;
  if (!isSettings) {
    el.innerHTML = `<div class="page-head"><h1>Профиль</h1></div><div class="grid g2"><div class="card"><h3>Жеке мәліметтер</h3><form id="pf"><div class="field"><label>Аты-жөні</label><input name="full_name" value="${esc(App.user.full_name)}" required minlength="2" maxlength="100"></div>
      <div class="field"><label>Электрондық пошта</label><input value="${esc(App.user.email)}" disabled></div><div class="form-err" id="pe"></div><button class="btn" type="submit">Сақтау</button></form></div>
      <div class="card"><h3>Құпиясөзді өзгерту</h3><form id="pw"><div class="field"><label>Ағымдағы құпиясөз</label><input type="password" name="current_password" required autocomplete="current-password"></div>
      <div class="field"><label>Жаңа құпиясөз</label><input type="password" name="new_password" required minlength="8" autocomplete="new-password"></div><div class="field"><label>Жаңа құпиясөзді растаңыз</label><input type="password" name="confirm_password" required autocomplete="new-password"></div>
      <div class="form-err" id="we"></div><button class="btn" type="submit">Құпиясөзді өзгерту</button></form></div></div>`;
    const sub = (id, errId, fn) => { const f = $(id); f.onsubmit = async (e) => { e.preventDefault(); const b = $('button', f); if (b.disabled) return; b.disabled = true; $(errId).textContent = ''; try { await fn(Object.fromEntries(new FormData(f))); } catch (x) { $(errId).textContent = x.message; } b.disabled = false; }; };
    sub('#pf', '#pe', async (d) => { await API.put('/api/profile', d); UI.toast('Профиль жаңартылды'); App.user.full_name = d.full_name; });
    sub('#pw', '#we', async (d) => { if (d.new_password !== d.confirm_password) throw new Error('Жаңа құпиясөздер сәйкес келмейді'); await API.post('/api/auth/change-password', d); $('#pw').reset(); UI.toast('Құпиясөз өзгертілді'); });
  } else {
    el.innerHTML = `<div class="page-head"><h1>Баптаулар</h1></div><div class="grid g2"><div class="card"><h3>Көрініс</h3><div class="field"><label>Тақырып</label><select id="theme"><option value="light">Ашық</option><option value="dark">Қараңғы</option></select></div>
      <div class="field"><label>Күн форматы</label><select id="df"><option value="long">12 қазан 2026</option><option value="dots">12.10.2026</option></select></div>
      <div class="field"><label>Бастапқы баланс (₸)</label><input id="sb" type="number" step="0.01" value="${S.starting_balance ?? 0}"></div></div>
      <div class="card"><h3>Қолданба ішіндегі хабарландырулар</h3>${chk('nb', 'Бюджет лимиті туралы', S.notify_budget)}${chk('np', 'Төлем мерзімдері туралы', S.notify_payments)}${chk('ng', 'Жинақ мақсаттары туралы', S.notify_goals)}
      <p class="note">Email және push хабарландырулары іске асырылмаған.</p></div></div><div class="mt"><button class="btn" id="save">Сақтау</button> <button class="btn ghost" id="lo">Шығу</button></div><div class="form-err" id="se"></div>`;
    $('#theme').value = S.theme; $('#df').value = S.date_format;
    $('#theme').onchange = (e) => App.applyTheme(e.target.value);
    $('#save').onclick = async (e) => { const b = e.target; b.disabled = true; $('#se').textContent = '';
      const d = { theme: $('#theme').value, date_format: $('#df').value, starting_balance: $('#sb').value || '0', notify_budget: $('#nb').checked, notify_payments: $('#np').checked, notify_goals: $('#ng').checked };
      try { await API.put('/api/settings', d); Object.assign(App.settings, d); UI.toast('Баптаулар сақталды'); } catch (x) { $('#se').textContent = x.message; } b.disabled = false; };
    $('#lo').onclick = () => $('#logout-btn').click();
  }
});
