import { api } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import { Spinner, ErrorBox, Stat, Badge } from '../../components/ui';
import { execStatus, relativeTime } from '../../lib/format';

export default function Overview({ instanceId, onGoto }: { instanceId: string; onGoto: (t: any) => void }) {
  const { data, loading, error, reload } = useAsync(() => api.instances.overview(instanceId), [instanceId]);

  if (loading)
    return (
      <div className="center-pad">
        <Spinner size={26} />
      </div>
    );
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const { workflows, executions } = data;

  return (
    <div className="overview">
      <div className="stat-row">
        <Stat label="Workflows" value={workflows.total} />
        <Stat label="Activos" value={workflows.active} kind="ok" />
        <Stat label="Inactivos" value={workflows.inactive} kind="muted" />
        <Stat
          label="Tasa de éxito"
          value={executions.successRate != null ? `${executions.successRate}%` : '—'}
          kind={executions.successRate != null && executions.successRate < 80 ? 'warn' : 'ok'}
        />
      </div>
      {workflows.hasMore && (
        <p className="hint-line">Mostrando los primeros 250 workflows para el conteo.</p>
      )}

      <div className="overview-section">
        <div className="section-head">
          <h2>Ejecuciones recientes</h2>
          <button className="link-btn" onClick={() => onGoto('executions')}>
            Ver todas →
          </button>
        </div>
        {executions.recent.length === 0 ? (
          <p className="muted">Sin ejecuciones recientes.</p>
        ) : (
          <ul className="exec-mini-list">
            {executions.recent.map((e) => {
              const st = execStatus(e.status, e.finished);
              return (
                <li key={e.id}>
                  <Badge kind={st.kind}>{st.label}</Badge>
                  <span className="exec-mini-mode">{e.mode}</span>
                  <span className="exec-mini-time">{relativeTime(e.startedAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
