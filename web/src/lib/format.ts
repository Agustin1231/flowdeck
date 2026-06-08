export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (isNaN(d)) return '—';
  const diff = Date.now() - d;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'hace instantes';
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `hace ${day} d`;
  return formatDate(iso);
}

export function duration(start?: string, stop?: string): string {
  if (!start || !stop) return '—';
  const ms = new Date(stop).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// Maps an n8n execution status to a label + CSS modifier.
export function execStatus(status?: string, finished?: boolean): { label: string; kind: string } {
  const s = (status || '').toLowerCase();
  if (s === 'success') return { label: 'Éxito', kind: 'ok' };
  if (s === 'error' || s === 'crashed' || s === 'failed') return { label: 'Error', kind: 'error' };
  if (s === 'running') return { label: 'Ejecutando', kind: 'running' };
  if (s === 'waiting') return { label: 'En espera', kind: 'waiting' };
  if (s === 'canceled' || s === 'cancelled') return { label: 'Cancelada', kind: 'muted' };
  if (finished) return { label: 'Finalizada', kind: 'muted' };
  return { label: status || 'Desconocido', kind: 'muted' };
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
