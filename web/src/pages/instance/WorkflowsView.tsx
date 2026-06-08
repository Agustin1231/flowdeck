import { useEffect, useState, useCallback } from 'react';
import { api, type Workflow } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/confirm';
import { Spinner, Switch, Badge, Button, EmptyState, ErrorBox } from '../../components/ui';
import { relativeTime } from '../../lib/format';
import WorkflowModal from '../../components/WorkflowModal';

type Filter = 'all' | 'active' | 'inactive';

export default function WorkflowsView({ instanceId }: { instanceId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Workflow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const debounced = useDebounced(search, 350);

  const load = useCallback(
    async (reset: boolean, cur?: string | null) => {
      reset ? setLoading(true) : setLoadingMore(true);
      setError(null);
      try {
        const params: any = { cursor: reset ? undefined : cur || undefined };
        if (debounced.trim()) params.name = debounced.trim();
        if (filter !== 'all') params.active = filter === 'active' ? 'true' : 'false';
        const page = await api.workflows.list(instanceId, params);
        setItems((prev) => (reset ? page.data : [...prev, ...page.data]));
        setCursor(page.nextCursor);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [instanceId, debounced, filter]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const toggle = async (wf: Workflow) => {
    setToggling((t) => ({ ...t, [wf.id]: true }));
    try {
      const updated = wf.active
        ? await api.workflows.deactivate(instanceId, wf.id)
        : await api.workflows.activate(instanceId, wf.id);
      setItems((prev) => prev.map((w) => (w.id === wf.id ? { ...w, active: updated.active ?? !wf.active } : w)));
      toast.success(`"${wf.name}" ${wf.active ? 'desactivado' : 'activado'}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setToggling((t) => ({ ...t, [wf.id]: false }));
    }
  };

  const remove = async (wf: Workflow) => {
    const ok = await confirm({
      title: 'Eliminar workflow',
      message: (
        <>
          ¿Eliminar <strong>{wf.name}</strong> de tu instancia de n8n? Esta acción es permanente.
        </>
      ),
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api.workflows.remove(instanceId, wf.id);
      setItems((prev) => prev.filter((w) => w.id !== wf.id));
      toast.success('Workflow eliminado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="wf-view">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="segmented">
          {(['all', 'active', 'inactive'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'seg active' : 'seg'} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="center-pad">
          <Spinner size={24} />
        </div>
      ) : error ? (
        <ErrorBox message={error} onRetry={() => load(true)} />
      ) : items.length === 0 ? (
        <EmptyState icon="🧩" title="Sin workflows" hint={debounced ? 'Probá con otro término de búsqueda.' : 'Esta instancia no tiene workflows todavía.'} />
      ) : (
        <>
          <div className="wf-list">
            {items.map((wf) => (
              <div className="wf-row" key={wf.id}>
                <div className="wf-toggle">
                  <Switch checked={wf.active} onChange={() => toggle(wf)} disabled={!!toggling[wf.id]} />
                </div>
                <button className="wf-main" onClick={() => setOpen(wf.id)}>
                  <span className="wf-name">{wf.name}</span>
                  <span className="wf-meta">
                    {wf.active ? <Badge kind="ok">Activo</Badge> : <Badge kind="muted">Inactivo</Badge>}
                    {wf.isArchived && <Badge kind="warn">Archivado</Badge>}
                    {(wf.tags || []).map((t) => (
                      <span key={t.id} className="tag">
                        {t.name}
                      </span>
                    ))}
                    <span className="wf-sub">{wf.nodes?.length ?? 0} nodos · {relativeTime(wf.updatedAt)}</span>
                  </span>
                </button>
                <div className="wf-actions">
                  <button className="link-btn" onClick={() => setOpen(wf.id)}>
                    Ver
                  </button>
                  <button className="link-btn danger" onClick={() => remove(wf)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {cursor && (
            <div className="load-more">
              <Button variant="ghost" loading={loadingMore} onClick={() => load(false, cursor)}>
                Cargar más
              </Button>
            </div>
          )}
        </>
      )}

      {open && (
        <WorkflowModal
          instanceId={instanceId}
          workflowId={open}
          onClose={() => setOpen(null)}
          onChanged={(wf) => setItems((prev) => prev.map((w) => (w.id === wf.id ? { ...w, ...wf } : w)))}
          onDeleted={(wfId) => {
            setItems((prev) => prev.filter((w) => w.id !== wfId));
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}
