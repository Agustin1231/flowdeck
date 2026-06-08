import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Execution } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useConfirm } from '../../components/confirm';
import { useAsync } from '../../lib/hooks';
import { Spinner, Badge, Button, EmptyState, ErrorBox } from '../../components/ui';
import { execStatus, formatDate, duration } from '../../lib/format';
import ExecutionModal from '../../components/ExecutionModal';

type Filter = 'all' | 'success' | 'error' | 'waiting';

export default function ExecutionsView({ instanceId }: { instanceId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Execution[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);

  // Map workflowId → name so the table is readable.
  const wfNames = useAsync(async () => {
    const page = await api.workflows.list(instanceId, { limit: 250 });
    const map: Record<string, string> = {};
    for (const w of page.data) map[w.id] = w.name;
    return map;
  }, [instanceId]);

  const load = useCallback(
    async (reset: boolean, cur?: string | null) => {
      reset ? setLoading(true) : setLoadingMore(true);
      setError(null);
      try {
        const params: any = { cursor: reset ? undefined : cur || undefined };
        if (filter !== 'all') params.status = filter;
        const page = await api.executions.list(instanceId, params);
        setItems((prev) => (reset ? page.data : [...prev, ...page.data]));
        setCursor(page.nextCursor);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [instanceId, filter]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const names = wfNames.data || {};

  const remove = async (exec: Execution) => {
    const ok = await confirm({
      title: 'Eliminar ejecución',
      message: <>¿Eliminar el registro de la ejecución #{exec.id}?</>,
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api.executions.remove(instanceId, exec.id);
      setItems((prev) => prev.filter((e) => e.id !== exec.id));
      toast.success('Ejecución eliminada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="exec-view">
      <div className="toolbar">
        <div className="segmented">
          {(['all', 'success', 'error', 'waiting'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'seg active' : 'seg'} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todas' : f === 'success' ? 'Éxito' : f === 'error' ? 'Error' : 'En espera'}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => load(true)}>
          ↻ Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="center-pad">
          <Spinner size={24} />
        </div>
      ) : error ? (
        <ErrorBox message={error} onRetry={() => load(true)} />
      ) : items.length === 0 ? (
        <EmptyState icon="📊" title="Sin ejecuciones" hint="Cuando tus workflows se ejecuten, vas a verlas acá." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Workflow</th>
                  <th>Modo</th>
                  <th>Inicio</th>
                  <th>Duración</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const st = execStatus(e.status, e.finished);
                  return (
                    <tr key={e.id} onClick={() => setOpen(e.id)} className="clickable-row">
                      <td>
                        <Badge kind={st.kind}>{st.label}</Badge>
                      </td>
                      <td className="cell-name">{e.workflowId ? names[e.workflowId] || e.workflowId : '—'}</td>
                      <td className="muted">{e.mode || '—'}</td>
                      <td className="muted">{formatDate(e.startedAt)}</td>
                      <td className="muted">{duration(e.startedAt, e.stoppedAt)}</td>
                      <td className="row-actions" onClick={(ev) => ev.stopPropagation()}>
                        <button className="link-btn danger" onClick={() => remove(e)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        <ExecutionModal
          instanceId={instanceId}
          executionId={open}
          workflowName={(() => {
            const ex = items.find((i) => i.id === open);
            return ex?.workflowId ? names[ex.workflowId] : undefined;
          })()}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
