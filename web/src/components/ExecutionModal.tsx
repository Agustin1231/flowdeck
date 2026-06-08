import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { Modal, Spinner, ErrorBox, Badge, Button } from './ui';
import { execStatus, formatDate, duration } from '../lib/format';

export default function ExecutionModal({
  instanceId,
  executionId,
  workflowName,
  onClose,
}: {
  instanceId: string;
  executionId: string;
  workflowName?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.executions.get(instanceId, executionId), [instanceId, executionId]);

  const copy = () => {
    if (!data) return;
    navigator.clipboard?.writeText(JSON.stringify(data, null, 2)).then(
      () => toast.success('JSON copiado'),
      () => toast.error('No se pudo copiar')
    );
  };

  const st = data ? execStatus(data.status, data.finished) : null;

  return (
    <Modal
      wide
      title={`Ejecución #${executionId}`}
      onClose={onClose}
      footer={
        data ? (
          <Button variant="ghost" onClick={copy}>
            Copiar JSON
          </Button>
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
        <div className="exec-detail">
          <dl className="kv">
            <div>
              <dt>Estado</dt>
              <dd>{st && <Badge kind={st.kind}>{st.label}</Badge>}</dd>
            </div>
            <div>
              <dt>Workflow</dt>
              <dd>{workflowName || data.workflowId || '—'}</dd>
            </div>
            <div>
              <dt>Modo</dt>
              <dd>{data.mode || '—'}</dd>
            </div>
            <div>
              <dt>Inicio</dt>
              <dd>{formatDate(data.startedAt)}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{duration(data.startedAt, data.stoppedAt)}</dd>
            </div>
            <div>
              <dt>Reintento de</dt>
              <dd>{data.retryOf || '—'}</dd>
            </div>
          </dl>

          {(data as any).data?.resultData?.error && (
            <div className="exec-error">
              <h4>Error</h4>
              <pre className="json-view error">
                {(data as any).data.resultData.error.message || JSON.stringify((data as any).data.resultData.error, null, 2)}
              </pre>
            </div>
          )}

          <h4>Datos de la ejecución</h4>
          <pre className="json-view tall">{JSON.stringify((data as any).data ?? data, null, 2)}</pre>
        </div>
      )}
    </Modal>
  );
}
