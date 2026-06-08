import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { Spinner, ErrorBox, Button } from '../components/ui';
import { hostFromUrl } from '../lib/format';
import InstanceForm from '../components/InstanceForm';
import Overview from './instance/Overview';
import WorkflowsView from './instance/WorkflowsView';
import ExecutionsView from './instance/ExecutionsView';

type Tab = 'overview' | 'workflows' | 'executions';

export default function InstanceDetail() {
  const { id = '' } = useParams();
  const inst = useAsync(() => api.instances.get(id), [id]);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);

  if (inst.loading) {
    return (
      <div className="center-pad">
        <Spinner size={28} />
      </div>
    );
  }
  if (inst.error || !inst.data) {
    return (
      <div className="page">
        <Link to="/" className="back-link">
          ← Instancias
        </Link>
        <ErrorBox message={inst.error || 'Instancia no encontrada'} onRetry={inst.reload} />
      </div>
    );
  }

  const instance = inst.data;

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← Instancias
      </Link>
      <div className="page-head">
        <div>
          <h1>{instance.name}</h1>
          <p className="page-sub">
            <a href={instance.url} target="_blank" rel="noreferrer" className="ext-link">
              {hostFromUrl(instance.url)} ↗
            </a>
          </p>
        </div>
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Editar conexión
        </Button>
      </div>

      <div className="tabs">
        <button className={tab === 'overview' ? 'tab active' : 'tab'} onClick={() => setTab('overview')}>
          Resumen
        </button>
        <button className={tab === 'workflows' ? 'tab active' : 'tab'} onClick={() => setTab('workflows')}>
          Workflows
        </button>
        <button className={tab === 'executions' ? 'tab active' : 'tab'} onClick={() => setTab('executions')}>
          Ejecuciones
        </button>
      </div>

      <div className="tab-panel">
        {tab === 'overview' && <Overview instanceId={id} onGoto={setTab} />}
        {tab === 'workflows' && <WorkflowsView instanceId={id} />}
        {tab === 'executions' && <ExecutionsView instanceId={id} />}
      </div>

      {editing && (
        <InstanceForm
          existing={instance}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            inst.reload();
          }}
        />
      )}
    </div>
  );
}
