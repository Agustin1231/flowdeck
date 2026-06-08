// Tiny typed client over the FlowDeck backend (`/api`). Cookies carry the
// session, so every request uses credentials: 'include'.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Lets the AuthProvider react to session loss from anywhere.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    ...opts,
  });
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth')) onUnauthorized?.();
    throw new ApiError(data?.error || `Error ${res.status}`, res.status);
  }
  return data as T;
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface Instance {
  id: string;
  name: string;
  apiBase: string;
  url: string;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  isArchived?: boolean;
  tags?: Tag[];
  triggerCount?: number;
  nodes?: any[];
  connections?: any;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: any;
}

export interface Execution {
  id: string;
  finished?: boolean;
  mode?: string;
  status?: string;
  startedAt?: string;
  stoppedAt?: string;
  workflowId?: string;
  retryOf?: string | null;
  [k: string]: any;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface Overview {
  workflows: { total: number; active: number; inactive: number; archived: number; hasMore: boolean };
  executions: {
    sampled: number;
    success: number;
    error: number;
    successRate: number | null;
    recent: Execution[];
  };
}

function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ── API surface ───────────────────────────────────────────────────────────
export const api = {
  auth: {
    status: () => request<{ needsSetup: boolean; authenticated: boolean; username: string | null }>('/auth/status'),
    setup: (username: string, password: string) =>
      request<{ username: string }>('/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      request<{ username: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },
  instances: {
    list: () => request<{ instances: Instance[] }>('/instances').then((r) => r.instances),
    get: (id: string) => request<{ instance: Instance }>(`/instances/${id}`).then((r) => r.instance),
    create: (body: { name: string; url: string; apiKey: string }) =>
      request<{ instance: Instance }>('/instances', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.instance),
    update: (id: string, body: { name?: string; url?: string; apiKey?: string }) =>
      request<{ instance: Instance }>(`/instances/${id}`, { method: 'PUT', body: JSON.stringify(body) }).then((r) => r.instance),
    remove: (id: string) => request(`/instances/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<{ ok: boolean; reachable: boolean; error?: string }>(`/instances/${id}/test`),
    overview: (id: string) => request<Overview>(`/instances/${id}/overview`),
  },
  workflows: {
    list: (id: string, params: { cursor?: string; active?: string; name?: string; limit?: number } = {}) =>
      request<Page<Workflow>>(`/instances/${id}/workflows${qs(params)}`),
    get: (id: string, wfId: string) => request<Workflow>(`/instances/${id}/workflows/${wfId}`),
    activate: (id: string, wfId: string) => request<Workflow>(`/instances/${id}/workflows/${wfId}/activate`, { method: 'POST' }),
    deactivate: (id: string, wfId: string) => request<Workflow>(`/instances/${id}/workflows/${wfId}/deactivate`, { method: 'POST' }),
    remove: (id: string, wfId: string) => request(`/instances/${id}/workflows/${wfId}`, { method: 'DELETE' }),
  },
  executions: {
    list: (id: string, params: { cursor?: string; status?: string; workflowId?: string; limit?: number } = {}) =>
      request<Page<Execution>>(`/instances/${id}/executions${qs(params)}`),
    get: (id: string, execId: string) => request<Execution>(`/instances/${id}/executions/${execId}?includeData=true`),
    remove: (id: string, execId: string) => request(`/instances/${id}/executions/${execId}`, { method: 'DELETE' }),
  },
  tags: {
    list: (id: string) => request<Page<Tag>>(`/instances/${id}/tags`),
  },
};
