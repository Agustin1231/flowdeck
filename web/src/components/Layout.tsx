import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';
import { Modal, Button, Field } from './ui';
import ThemeToggle from './ThemeToggle';

function Logo() {
  return (
    <Link to="/" className="brand">
      <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2B7DE9" />
            <stop offset="1" stopColor="#154AB5" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="24" fill="url(#bg)" />
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
      <span>FlowDeck</span>
    </Link>
  );
}

function AccountMenu() {
  const { username, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);

  const changePwd = async () => {
    setSaving(true);
    try {
      await api.auth.changePassword(cur, next);
      toast.success('Contraseña actualizada');
      setShowPwd(false);
      setCur('');
      setNext('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account">
      <button className="account-btn" onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}>
        <span className="avatar">{(username || '?').charAt(0).toUpperCase()}</span>
        <span className="account-name">{username}</span>
      </button>
      {open && (
        <div className="menu">
          <button
            className="menu-item"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowPwd(true);
              setOpen(false);
            }}
          >
            Cambiar contraseña
          </button>
          <button
            className="menu-item danger"
            onMouseDown={(e) => {
              e.preventDefault();
              logout();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}
      {showPwd && (
        <Modal
          title="Cambiar contraseña"
          onClose={() => setShowPwd(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowPwd(false)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={saving} onClick={changePwd} disabled={!cur || next.length < 6}>
                Guardar
              </Button>
            </>
          }
        >
          <Field label="Contraseña actual">
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 6 caracteres">
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

export default function Layout() {
  const loc = useLocation();
  const onInstance = /^\/instances\//.test(loc.pathname);
  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <nav className="topnav">
          <Link to="/" className={!onInstance ? 'active' : ''}>
            Instancias
          </Link>
        </nav>
        <ThemeToggle />
        <AccountMenu />
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
