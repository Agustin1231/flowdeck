// Thin client over the n8n public REST API (/api/v1). Every request carries the
// instance's API key in the X-N8N-API-KEY header, server-side only, so the key
// is never shipped to the browser.

const DEFAULT_TIMEOUT_MS = 20000;

// Accepts whatever the user pasted (e.g. https://host/home/workflows) and
// returns the API base, e.g. https://host/api/v1
export function normalizeApiBase(input) {
  if (!input || typeof input !== 'string') throw new Error('URL requerida');
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  raw = raw.replace(/\/+$/, '');

  // Already an API base → keep as-is (supports sub-path deployments).
  if (/\/api\/v1$/i.test(raw)) return raw;
  if (/\/api\/v1\//i.test(raw)) return raw.replace(/(\/api\/v1).*$/i, '$1');

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL inválida');
  }
  // Strip the n8n UI paths people usually copy (/home, /workflow, /workflows,
  // /executions, /home/workflows…). Anything left is treated as a base sub-path.
  let pathname = url.pathname.replace(/\/+$/, '');
  pathname = pathname.replace(/\/(home|workflow|workflows|executions|credentials|settings)(\/.*)?$/i, '');
  pathname = pathname.replace(/\/+$/, '');
  return `${url.origin}${pathname}/api/v1`;
}

// Human-friendly origin (for display): https://host
export function displayUrl(apiBase) {
  try {
    const u = new URL(apiBase);
    const base = apiBase.replace(/\/api\/v1$/i, '');
    return base || u.origin;
  } catch {
    return apiBase;
  }
}

export async function n8nRequest(apiBase, apiKey, pathName, { method = 'GET', query, body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const url = new URL(apiBase.replace(/\/+$/, '') + pathName);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'X-N8N-API-KEY': apiKey,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const e = new Error('La instancia de n8n no respondió a tiempo');
      e.status = 504;
      throw e;
    }
    const e = new Error(`No se pudo conectar con la instancia: ${err.message}`);
    e.status = 502;
    throw e;
  }
  clearTimeout(timer);

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const e = new Error(
      (data && (data.message || data.error)) ||
        `La instancia de n8n devolvió ${res.status}`
    );
    e.status = res.status === 401 ? 401 : res.status >= 500 ? 502 : res.status;
    e.upstreamStatus = res.status;
    throw e;
  }
  return data;
}
