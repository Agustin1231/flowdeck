import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { encryptSecret, decryptSecret, randomId } from '../crypto.js';
import { normalizeApiBase, displayUrl, n8nRequest } from '../n8n.js';

export const instancesRouter = express.Router();
instancesRouter.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────
function publicInstance(inst) {
  return {
    id: inst.id,
    name: inst.name,
    apiBase: inst.apiBase,
    url: displayUrl(inst.apiBase),
    hasApiKey: !!inst.apiKeyEnc,
    createdAt: inst.createdAt,
    updatedAt: inst.updatedAt,
  };
}

function getInstanceOr404(req, res) {
  const inst = db.data.instances.find((i) => i.id === req.params.id);
  if (!inst) {
    res.status(404).json({ error: 'Instancia no encontrada' });
    return null;
  }
  return inst;
}

function instanceKey(inst) {
  return decryptSecret(inst.apiKeyEnc, db.appSecret());
}

// Wraps a proxied n8n call: resolves creds, forwards errors with proper status.
async function proxy(inst, res, pathName, opts) {
  try {
    const apiKey = instanceKey(inst);
    if (!apiKey) {
      return res.status(400).json({ error: 'La instancia no tiene API key configurada' });
    }
    const data = await n8nRequest(inst.apiBase, apiKey, pathName, opts);
    return res.json(data);
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ error: err.message || 'Error al comunicarse con n8n', upstreamStatus: err.upstreamStatus });
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────────
instancesRouter.get('/', (req, res) => {
  res.json({ instances: db.data.instances.map(publicInstance) });
});

instancesRouter.get('/:id', (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  res.json({ instance: publicInstance(inst) });
});

instancesRouter.post('/', async (req, res) => {
  const { name, url, apiKey } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!url || !String(url).trim()) return res.status(400).json({ error: 'La URL es obligatoria' });
  if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: 'La API key es obligatoria' });

  let apiBase;
  try {
    apiBase = normalizeApiBase(url);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Validate the connection before saving so a typo fails loudly.
  try {
    await n8nRequest(apiBase, String(apiKey).trim(), '/workflows', { query: { limit: 1 } });
  } catch (err) {
    return res.status(err.status === 401 ? 401 : 400).json({
      error:
        err.status === 401
          ? 'API key rechazada por n8n (401). Revisá la key.'
          : `No se pudo validar la conexión: ${err.message}`,
    });
  }

  const now = new Date().toISOString();
  const inst = {
    id: randomId(),
    name: String(name).trim(),
    apiBase,
    apiKeyEnc: encryptSecret(String(apiKey).trim(), db.appSecret()),
    createdAt: now,
    updatedAt: now,
  };
  db.data.instances.push(inst);
  db.save();
  res.status(201).json({ instance: publicInstance(inst) });
});

instancesRouter.put('/:id', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  const { name, url, apiKey } = req.body || {};

  let nextApiBase = inst.apiBase;
  if (url && String(url).trim()) {
    try {
      nextApiBase = normalizeApiBase(url);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
  // Use the new key if provided, otherwise keep the stored one for re-validation.
  const keyToUse = apiKey && String(apiKey).trim() ? String(apiKey).trim() : instanceKey(inst);
  if (keyToUse) {
    try {
      await n8nRequest(nextApiBase, keyToUse, '/workflows', { query: { limit: 1 } });
    } catch (err) {
      return res.status(err.status === 401 ? 401 : 400).json({
        error:
          err.status === 401
            ? 'API key rechazada por n8n (401). Revisá la key.'
            : `No se pudo validar la conexión: ${err.message}`,
      });
    }
  }

  if (name && String(name).trim()) inst.name = String(name).trim();
  inst.apiBase = nextApiBase;
  if (apiKey && String(apiKey).trim()) {
    inst.apiKeyEnc = encryptSecret(String(apiKey).trim(), db.appSecret());
  }
  inst.updatedAt = new Date().toISOString();
  db.save();
  res.json({ instance: publicInstance(inst) });
});

instancesRouter.delete('/:id', (req, res) => {
  const idx = db.data.instances.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Instancia no encontrada' });
  db.data.instances.splice(idx, 1);
  db.save();
  res.json({ ok: true });
});

// Connectivity check (also returns a couple of counts for the card).
instancesRouter.get('/:id/test', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  try {
    const apiKey = instanceKey(inst);
    const data = await n8nRequest(inst.apiBase, apiKey, '/workflows', { query: { limit: 1 } });
    res.json({ ok: true, reachable: true });
  } catch (err) {
    res.json({ ok: false, reachable: false, status: err.status, error: err.message });
  }
});

// ── Aggregated overview ───────────────────────────────────────────────────
instancesRouter.get('/:id/overview', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  try {
    const apiKey = instanceKey(inst);
    // Pull a generous page of workflows for accurate counts; n8n caps page size.
    const [wf, exec] = await Promise.all([
      n8nRequest(inst.apiBase, apiKey, '/workflows', { query: { limit: 250 } }),
      n8nRequest(inst.apiBase, apiKey, '/executions', { query: { limit: 20 } }).catch(() => ({ data: [] })),
    ]);
    const workflows = wf.data || [];
    const active = workflows.filter((w) => w.active).length;
    const archived = workflows.filter((w) => w.isArchived).length;
    const executions = exec.data || [];
    const finished = executions.filter((e) => e.status && e.status !== 'running' && e.status !== 'waiting');
    const success = finished.filter((e) => e.status === 'success').length;
    res.json({
      workflows: {
        total: workflows.length,
        active,
        inactive: workflows.length - active,
        archived,
        hasMore: !!wf.nextCursor,
      },
      executions: {
        sampled: executions.length,
        success,
        error: finished.length - success,
        successRate: finished.length ? Math.round((success / finished.length) * 100) : null,
        recent: executions.slice(0, 8),
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Workflow proxy ──────────────────────────────────────────────────────────
instancesRouter.get('/:id/workflows', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  const { cursor, active, name, tags, limit } = req.query;
  await proxy(inst, res, '/workflows', {
    query: { cursor, active, name, tags, limit: limit || 50 },
  });
});

instancesRouter.get('/:id/workflows/:wfId', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, `/workflows/${encodeURIComponent(req.params.wfId)}`);
});

instancesRouter.post('/:id/workflows/:wfId/activate', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, `/workflows/${encodeURIComponent(req.params.wfId)}/activate`, { method: 'POST' });
});

instancesRouter.post('/:id/workflows/:wfId/deactivate', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, `/workflows/${encodeURIComponent(req.params.wfId)}/deactivate`, { method: 'POST' });
});

instancesRouter.delete('/:id/workflows/:wfId', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, `/workflows/${encodeURIComponent(req.params.wfId)}`, { method: 'DELETE' });
});

// ── Executions proxy ──────────────────────────────────────────────────────
instancesRouter.get('/:id/executions', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  const { cursor, status, workflowId, limit, includeData } = req.query;
  await proxy(inst, res, '/executions', {
    query: { cursor, status, workflowId, includeData, limit: limit || 30 },
  });
});

instancesRouter.get('/:id/executions/:execId', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, `/executions/${encodeURIComponent(req.params.execId)}`, {
    query: { includeData: req.query.includeData ?? 'true' },
  });
});

instancesRouter.delete('/:id/executions/:execId', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, `/executions/${encodeURIComponent(req.params.execId)}`, { method: 'DELETE' });
});

// ── Tags ──────────────────────────────────────────────────────────────────
instancesRouter.get('/:id/tags', async (req, res) => {
  const inst = getInstanceOr404(req, res);
  if (!inst) return;
  await proxy(inst, res, '/tags', { query: { limit: 100 } });
});
