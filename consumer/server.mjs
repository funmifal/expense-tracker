import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_API = process.env.API_URL ?? 'https://expense-tracker-blond-one-51.vercel.app';
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? 'aric.kihn.151@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';
const PORT = Number(process.env.PORT ?? 3100);
const PAGE_SIZE = 3;

if (/localhost|127\.0\.0\.1/.test(PUBLIC_API)) {
  throw new Error(`Consumer must target the public API URL, got: ${PUBLIC_API}`);
}

let sessionCookie = null;

function cookieFrom(res) {
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function ensureSession() {
  const login = await fetch(`${PUBLIC_API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });

  if (login.status === 200) {
    sessionCookie = cookieFrom(login);
    return;
  }

  await fetch(`${PUBLIC_API}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD, currency: 'USD' }),
  });

  const login2 = await fetch(`${PUBLIC_API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });

  if (login2.status !== 200) {
    throw new Error(`Could not authenticate against ${PUBLIC_API} (${login2.status})`);
  }
  sessionCookie = cookieFrom(login2);
}

async function apiFetch(pathname, { method = 'GET', body, retryOn401 = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (sessionCookie) headers.cookie = sessionCookie;

  const res = await fetch(`${PUBLIC_API}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retryOn401) {
    await ensureSession();
    return apiFetch(pathname, { method, body, retryOn401: false });
  }

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function listByKey(apiPath, key) {
  const { status, body } = await apiFetch(apiPath);
  if (status !== 200) throw new Error(`GET ${apiPath} failed with ${status}`);
  const map = new Map();
  for (const item of body.data ?? []) map.set(item.id, item[key]);
  return map;
}

async function getExpenses(search) {
  const offset = Math.max(0, Number.parseInt(search.get('offset') ?? '0', 10) || 0);
  const categoryId = search.get('categoryId') ?? '';

  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    sort: 'date',
    order: 'desc',
  });
  if (categoryId) query.set('categoryId', categoryId);

  const { status, body } = await apiFetch(`/api/v1/expenses?${query}`);
  if (status !== 200) throw new Error(`GET /api/v1/expenses?${query} failed with ${status}`);

  const categoryNames = await listByKey('/api/v1/categories', 'name');
  const paymentNames = await listByKey('/api/v1/payment-methods', 'name');

  const rows = (body.data ?? []).map((expense) => ({
    id: expense.id,
    date: expense.date,
    amountMinorUnits: expense.amountMinorUnits,
    currency: expense.currency,
    category: categoryNames.get(expense.categoryId) ?? '—',
    paymentMethod: paymentNames.get(expense.paymentMethodId) ?? '—',
    description: expense.description ?? '',
  }));

  return { data: rows, meta: body.meta ?? { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false } };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (url.pathname === '/api/categories') {
      const { status, body } = await apiFetch('/api/v1/categories');
      sendJson(res, status, body);
      return;
    }

    if (url.pathname === '/api/expenses') {
      sendJson(res, 200, await getExpenses(url.searchParams));
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 503, { error: { message: error.message ?? 'Consumer failed to reach the public API' } });
  }
});

await ensureSession();
console.log(`Expense Tracker API consumer running at http://localhost:${PORT}`);
console.log(`Consuming the public API at ${PUBLIC_API} as ${DEMO_EMAIL}`);
server.listen(PORT);