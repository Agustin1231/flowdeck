import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from './api';

interface AuthState {
  loading: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
  login: (u: string, p: string) => Promise<void>;
  setup: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    needsSetup: false,
    authenticated: false,
    username: null,
  });

  const refresh = async () => {
    try {
      const s = await api.auth.status();
      setState({ loading: false, needsSetup: s.needsSetup, authenticated: s.authenticated, username: s.username });
    } catch {
      setState({ loading: false, needsSetup: false, authenticated: false, username: null });
    }
  };

  useEffect(() => {
    // If any request 401s, drop to the login screen.
    setUnauthorizedHandler(() => setState((s) => ({ ...s, authenticated: false })));
    refresh();
  }, []);

  const login = async (u: string, p: string) => {
    const r = await api.auth.login(u, p);
    setState((s) => ({ ...s, authenticated: true, needsSetup: false, username: r.username }));
  };

  const setup = async (u: string, p: string) => {
    const r = await api.auth.setup(u, p);
    setState((s) => ({ ...s, authenticated: true, needsSetup: false, username: r.username }));
  };

  const logout = async () => {
    await api.auth.logout();
    setState((s) => ({ ...s, authenticated: false }));
  };

  return (
    <AuthContext.Provider value={{ ...state, refresh, login, setup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
