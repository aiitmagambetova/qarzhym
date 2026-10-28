// Іске қосылған сервер қажет:  BASE_URL=http://localhost:3000 npm test
const test = require('node:test'); const assert = require('node:assert');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

class Client {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async req(method, url, body) {
    if (method !== 'GET' && !this.csrf) await this.token();
    const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', Cookie: this.cookie, 'X-CSRF-Token': this.csrf }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({})); return { status: r.status, body: j };
  }
  async token() { const r = await this.req('GET', '/api/auth/csrf'); this.csrf = r.body.data.csrfToken; }
}
const uniq = Date.now();
const mk = async (n) => { const c = new Client(); await c.token();
  const r = await c.req('POST', '/api/auth/register', { full_name: 'Тест ' + n, email: `t${n}_${uniq}@example.com`, password: 'Test1234', confirm_password: 'Test1234' });
  assert.equal(r.status, 201); c.csrf = r.body.data.csrfToken; return c; };

test('health', async () => { const r = await new Client().req('GET', '/api/health'); assert.equal(r.status, 200); });
test('private API requires auth', async () => { const r = await new Client().req('GET', '/api/transactions'); assert.equal(r.status, 401); });
test('mutation without CSRF is rejected', async () => { const c = new Client(); const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(r.status, 403); });

test('transactions, budgets, savings and isolation', async () => {
  const a = await mk('a'), b = await mk('b');
  const cats = (await a.req('GET', '/api/categories')).body.data.items;
  const exp = cats.find((c) => c.type === 'expense'), inc = cats.find((c) => c.type === 'income');
  const today = new Date().toISOString().slice(0, 10);
  assert.equal((await a.req('POST', '/api/transactions', { title: 'x', amount: -5, type: 'expense', category_id: exp.id, tx_date: today })).status, 422);
  assert.equal((await a.req('POST', '/api/transactions', { title: 'x', amount: 10, type: 'expense', category_id: exp.id, tx_date: '2026-02-31' })).status, 422);
  assert.equal((await a.req('POST', '/api/transactions', { title: 'Жалақы', amount: 100000, type: 'income', category_id: inc.id, tx_date: today })).status, 201);
  const t = await a.req('POST', '/api/transactions', { title: 'Нан', amount: 2500.5, type: 'expense', category_id: exp.id, tx_date: today });
  assert.equal(t.status, 201);
  const d = (await a.req('GET', '/api/dashboard')).body.data;
  assert.equal(d.summary.balance, 97499.5);
  // бюджет
  const bu = await a.req('POST', '/api/budgets', { name: 'Тест', category_id: exp.id, amount: 3000, period: 'monthly', start_date: today.slice(0, 8) + '01' });
  assert.equal(bu.status, 201);
  const bl = (await a.req('GET', '/api/budgets')).body.data[0];
  assert.equal(bl.spent, 2500.5); assert.equal(bl.status, 'warning');
  // басқа пайдаланушының санаты/жазбасы
  assert.equal((await b.req('POST', '/api/transactions', { title: 'x', amount: 1, type: 'expense', category_id: exp.id, tx_date: today })).status, 422);
  assert.equal((await b.req('GET', `/api/transactions/${t.body.data.id}`)).status, 404);
  assert.equal((await b.req('DELETE', `/api/transactions/${t.body.data.id}`)).status, 404);
  // қолданыстағы санатты жою
  assert.equal((await a.req('DELETE', `/api/categories/${exp.id}`)).status, 409);
  // жинақ
  const g = await a.req('POST', '/api/savings', { title: 'Ноутбук', target_amount: 1000 });
  const gid = g.body.data.id;
  assert.equal((await a.req('POST', `/api/savings/${gid}/contributions`, { amount: 400, type: 'deposit' })).status, 201);
  assert.equal((await a.req('POST', `/api/savings/${gid}/contributions`, { amount: 500, type: 'withdrawal' })).status, 422);
  assert.equal((await a.req('GET', `/api/savings/${gid}`)).body.data.remaining, 600);
  const d2 = (await a.req('GET', '/api/dashboard')).body.data; assert.equal(d2.summary.expense, 2500.5); // жинақ шығыс емес
});
test('duplicate email', async () => {
  const c = new Client(); await c.token(); const body = { full_name: 'Дубль', email: `dup_${uniq}@example.com`, password: 'Test1234', confirm_password: 'Test1234' };
  assert.equal((await c.req('POST', '/api/auth/register', body)).status, 201); c.csrf = ''; await c.token();
  assert.equal((await new Client().req('POST', '/api/auth/register', body)).status, 409);
});
