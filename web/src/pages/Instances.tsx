import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Instance } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { useConfirm } from '../components/confirm';
import { Button, Spinner, EmptyState, ErrorBox } from '../components/ui';
import InstanceForm from '../components/InstanceForm';
import { hostFromUrl } from '../lib/format';

function InstanceCard({
  inst,
  onEdit,
  onDelete,
}: {
  inst: Instance;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ov = useAsync(() => api.instances.overview(inst.id), [inst.id]);

  return (
    <div className="card instance-card">
      <Link to={`/instances/${inst.id}`} className="instance-card-main">
        <div className="instance-card-head">
          <div>
            <h3>{inst.name}</h3>
            <span className="instance-host">{hostFromUrl(inst.url)}</span>
          </div>
          <span className={`status-dot ${ov.loading ? 'pending' : ov.error ? 'down' : 'up'}`} title={ov.error ? 'No disponible' : 'Conectada'} />
        </div>

        {ov.loading ? (
          <div className="instance-card-loading">
            <Spinner size={16} /> <span>Conectando…</span>
          </div>
        ) : ov.error ? (
          <div className="instance-card-error">No se pudo conectar</div>
        ) : (
          <div className="instance-mini-stats">
            <div>
              <strong>{ov.data!.workflows.total}</strong>
              <span>workflows</span>
            </div>
            <div className="ok">
              <strong>{ov.data!.workflows.active}</strong>
              <span>activos</span>
            </div>
            <div>
              <strong>{ov.data!.executions.successRate != null ? `${ov.data!.executions.successRate}%` : '—'}</strong>
              <span>éxito</span>
            </div>
          </div>
        )}
      </Link>
      <div className="instance-card-actions">
        <button className="link-btn" onClick={onEdit}>
          Editar
        </button>
        <button className="link-btn danger" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </div>
  );
}

export default function Instances() {
  const { data, loading, error, reload, setData } = useAsync(() => api.instances.list(), []);
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (inst: Instance) => {
    setEditing(inst);
    setShowForm(true);
  };

  const remove = async (inst: Instance) => {
    const ok = await confirm({
      title: 'Eliminar instancia',
      message: (
        <>
          ¿Eliminar <strong>{inst.name}</strong> de FlowDeck? Esto no toca tu n8n, solo quita la conexión guardada acá.
        </>
      ),
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api.instances.remove(inst.id);
      setData((data || []).filter((i) => i.id !== inst.id));
      toast.success('Instancia eliminada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Instancias</h1>
          <p className="page-sub">Conectá y gestioná tus servidores de n8n desde un solo lugar.</p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          + Conectar instancia
        </Button>
      </div>

      {loading ? (
        <div className="center-pad">
          <Spinner size={28} />
        </div>
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : data && data.length === 0 ? (
        <EmptyState
          icon="🔗"
          title="Todavía no hay instancias"
          hint="Conectá tu primer n8n con su URL y una API key para gestionar workflows y ejecuciones."
          action={
            <Button variant="primary" onClick={openAdd}>
              + Conectar instancia
            </Button>
          }
        />
      ) : (
        <div className="grid">
          {data!.map((inst) => (
            <InstanceCard key={inst.id} inst={inst} onEdit={() => openEdit(inst)} onDelete={() => remove(inst)} />
          ))}
        </div>
      )}

      {showForm && (
        <InstanceForm
          existing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
