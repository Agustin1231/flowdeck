import { useState } from 'react';
import { api, type Instance } from '../lib/api';
import { useToast } from '../lib/toast';
import { Modal, Button, Field } from './ui';

export default function InstanceForm({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Instance | null;
  onClose: () => void;
  onSaved: (inst: Instance) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(existing?.name || '');
  const [url, setUrl] = useState(existing?.url || '');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = !!existing;

  const submit = async () => {
    setSaving(true);
    try {
      const inst = editing
        ? await api.instances.update(existing!.id, { name, url, apiKey: apiKey || undefined })
        : await api.instances.create({ name, url, apiKey });
      toast.success(editing ? 'Instancia actualizada' : 'Instancia conectada');
      onSaved(inst);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim() && url.trim() && (editing || apiKey.trim());

  return (
    <Modal
      title={editing ? 'Editar instancia' : 'Conectar instancia de n8n'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={submit} disabled={!canSave}>
            {editing ? 'Guardar cambios' : 'Conectar'}
          </Button>
        </>
      }
    >
      <Field label="Nombre">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi n8n de producción" autoFocus />
      </Field>
      <Field label="URL de n8n" hint="Pegá la URL de tu n8n (p. ej. https://n8n.tudominio.com). FlowDeck encuentra la API sola.">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://n8n.tudominio.com" spellCheck={false} />
      </Field>
      <Field
        label={editing ? 'API key (dejar vacío para mantener la actual)' : 'API key'}
        hint={
          <>
            La generás en n8n: <strong>Settings → n8n API → Create an API key</strong>. Se guarda cifrada en el servidor.
          </>
        }
      >
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={editing ? '•••••••••• (sin cambios)' : 'n8n_api_...'}
          spellCheck={false}
          type="password"
          autoComplete="off"
        />
      </Field>
      <p className="form-note">Al guardar, FlowDeck valida la conexión contra tu instancia antes de almacenarla.</p>
    </Modal>
  );
}
