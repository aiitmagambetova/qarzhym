// Бірыңғай API көмекшісі (cookie-сессия + CSRF токені жадта ғана сақталады)
const API = (() => {
  let csrf = null;
  async function getCsrf(force) {
    if (csrf && !force) return csrf;
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    csrf = (await r.json()).data.csrfToken;
    return csrf;
  }
  async function request(method, url, body, opts = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET') { try { headers['X-CSRF-Token'] = await getCsrf(); } catch { throw new Error('Серверге қосылу мүмкін болмады. Интернетті немесе серверді тексеріңіз.'); } }
    let res;
    try { res = await fetch(url, { method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error('Сервер қолжетімсіз. Байланысты тексеріп, қайталап көріңіз.'); }
    let json = null;
    try { json = await res.json(); } catch { /* JSON емес */ }
    if (res.status === 401 && !opts.noRedirect && !/login|register/.test(location.pathname)) { location.href = '/login.html'; throw new Error('Сессия аяқталды'); }
    if (res.status === 403 && !opts.retried) { await getCsrf(true); return request(method, url, body, { ...opts, retried: true }); }
    if (!res.ok || !json || json.success === false) throw new Error((json && json.message) || 'Сұраныс орындалмады');
    return json.data;
  }
  const qs = (o) => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ''; };
  return {
    get: (u, params, o) => request('GET', u + qs(params), undefined, o),
    post: (u, b, o) => request('POST', u, b ?? {}, o), put: (u, b) => request('PUT', u, b),
    patch: (u, b) => request('PATCH', u, b ?? {}), del: (u) => request('DELETE', u),
    resetCsrf: () => { csrf = null; },
    setCsrf: (t) => { csrf = t; },
  };
})();
