(() => {
  const form = $('#auth-form'); const mode = form.dataset.mode; const err = $('#auth-err'); const btn = $('button[type=submit]', form);
  API.get('/api/auth/me', null, { noRedirect: true }).then(() => { location.href = '/index.html'; }).catch(() => {});
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (btn.disabled) return; err.textContent = '';
    const d = Object.fromEntries(new FormData(form));
    if (mode === 'register') {
      if (d.password !== d.confirm_password) { err.textContent = 'Құпиясөздер сәйкес келмейді'; return; }
      if (d.password.length < 8 || !/\d/.test(d.password) || !/\D/.test(d.password)) { err.textContent = 'Құпиясөз кемінде 8 таңба, әріп және сан болуы керек'; return; }
    }
    btn.disabled = true;
    try { const r = await API.post(`/api/auth/${mode}`, d, { noRedirect: true }); API.setCsrf(r.csrfToken); location.href = '/index.html'; }
    catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });
})();
