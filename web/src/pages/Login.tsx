import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Field } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';

function AuthBrand() {
  return (
    <div className="auth-brand">
      <svg width="56" height="56" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="authg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2B7DE9" />
            <stop offset="1" stopColor="#154AB5" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="24" fill="url(#authg)" />
        <g stroke="#fff" strokeWidth="3.4" strokeOpacity="0.85" fill="none">
          <line x1="27" y1="31" x2="50" y2="52" />
          <line x1="50" y1="52" x2="73" y2="72" />
          <line x1="50" y1="52" x2="73" y2="30" />
        </g>
        <g fill="#fff">
          <circle cx="27" cy="31" r="8" />
          <circle cx="50" cy="52" r="8" />
          <circle cx="73" cy="72" r="8" />
          <circle cx="73" cy="30" r="8" />
        </g>
      </svg>
      <h1>FlowDeck</h1>
      <p>Centro de control para tus instancias de n8n</p>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={submit}>
        <AuthBrand />
        <Field label="Usuario">
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {error && <div className="auth-error">{error}</div>}
        <Button variant="primary" type="submit" loading={loading} className="auth-submit" disabled={!username || !password}>
          Iniciar sesión
        </Button>
      </form>
    </div>
  );
}

export function Setup() {
  const { setup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await setup(username, password);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <form className="auth-card" onSubmit={submit}>
        <AuthBrand />
        <div className="auth-welcome">Creá tu cuenta de administrador para empezar.</div>
        <Field label="Usuario" hint="Mínimo 3 caracteres">
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </Field>
        <Field label="Contraseña" hint="Mínimo 6 caracteres">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repetir contraseña">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <div className="auth-error">{error}</div>}
        <Button
          variant="primary"
          type="submit"
          loading={loading}
          className="auth-submit"
          disabled={username.length < 3 || password.length < 6}
        >
          Crear cuenta
        </Button>
      </form>
    </div>
  );
}
