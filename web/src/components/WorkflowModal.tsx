import { useState } from 'react';
import { api, type Workflow } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { useConfirm } from './confirm';
import { Modal, Spinner, ErrorBox, Switch, Badge, Button } from './ui';
import { formatDate } from '../lib/format';

export default function WorkflowModal({
  instanceId,
  workflowId,
  onClose,
  onChanged,
  onDeleted,
}: {
  instanceId: string;
  workflowId: string;
  onClose: () => void;
  onChanged: (wf: Workflow) => void;
  onDeleted: (wfId: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload, setData } = useAsync(() => api.workflows.get(instanceId, workflowId), [instanceId, workflowId]);
  const [toggling, setToggling] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const toggle = async () => {
    if (!data) return;
    setToggling(true);
    try {
      const updated = data.active
        ? await api.workflows.deactivate(instanceId, workflowId)
        : await api.workflows.activate(instanceId, workflowId);
      const next = { ...data, active: updated.active ?? !data.active };
      setData(next);
      onChanged(next);
      toast.success(data.active ? 'Workflow desactivado' : 'Workflow activado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setToggling(false);
    }
  };

  const remove = async () => {
    if (!data) return;
    const ok = await confirm({
      title: 'Eliminar workflow',
      message: (
        <>
          ¿Eliminar <strong>{data.name}</strong> de tu instancia de n8n? Esta acción es permanente.
        </>
      ),
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api.workflows.remove(instanceId, workflowId);
      toast.success('Workflow eliminado');
      onDeleted(workflowId);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      wide
      title={data ? data.name : 'Workflow'}
      onClose={onClose}
      footer={
        data ? (
          <>
            <Button variant="danger" onClick={remove}>
              Eliminar
            </Button>
            <div style={{ flex: 1 }} />
            <span className="toggle-inline">
              {data.active ? 'Activo' : 'Inactivo'}
              <Switch checked={data.active} onChange={toggle} disabled={toggling} />
            </span>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="center-pad">
          <Spinner size={24} />
        </div>
      ) : error || !data ? (
        <ErrorBox message={error || 'No se pudo cargar'} onRetry={reload} />
      ) : (
        <div className="wf-detail">
          <div className="wf-detail-meta">
            {data.active ? <Badge kind="ok">Activo</Badge> : <Badge kind="muted">Inactivo</Badge>}
            {data.isArchived && <Badge kind="warn">Archivado</Badge>}
            {(data.tags || []).map((t) => (
              <span key={t.id} className="tag">
                {t.name}
              </span>
            ))}
          </div>
          <dl className="kv">
            <div>
              <dt>ID</dt>
              <dd className="mono">{data.id}</dd>
            </div>
            <div>
              <dt>Nodos</dt>
              <dd>{data.nodes?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Creado</dt>
              <dd>{formatDate(data.createdAt)}</dd>
            </div>
            <div>
              <dt>Actualizado</dt>
              <dd>{formatDate(data.updatedAt)}</dd>
            </div>
          </dl>

          {data.nodes && data.nodes.length > 0 && (
            <div className="node-list">
              <h4>Nodos</h4>
              <ul>
                {data.nodes.map((n: any, i: number) => (
                  <li key={n.id || i}>
                    <span className="node-name">{n.name}</span>
                    <span className="node-type">{String(n.type || '').replace('n8n-nodes-base.', '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="link-btn" onClick={() => setShowJson((s) => !s)}>
            {showJson ? 'Ocultar' : 'Ver'} JSON completo
          </button>
          {showJson && <pre className="json-view">{JSON.stringify(data, null, 2)}</pre>}
        </div>
      )}
    </Modal>
  );
}
