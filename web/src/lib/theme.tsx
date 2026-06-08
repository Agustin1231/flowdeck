import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'flowdeck-theme';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

function currentFromDom(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function setMeta(theme: Theme) {
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', theme === 'dark' ? '#0f1219' : '#ffffff');
}

// Applies the theme to <html>, with an optional brief CSS transition (matches
// the portfolio's `data-theme-transition` approach).
function apply(theme: Theme, withTransition: boolean) {
  if (withTransition) {
    document.documentElement.setAttribute('data-theme-transition', '');
    window.setTimeout(() => document.documentElement.removeAttribute('data-theme-transition'), 350);
  }
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  setMeta(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline <head> script already set the initial theme; read it from the DOM.
  const [theme, setTheme] = useState<Theme>(() => currentFromDom());

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      apply(next, true);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Follow the OS preference while the user hasn't made an explicit choice.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* ignore */
    }
    if (saved === 'dark' || saved === 'light') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const t: Theme = mq.matches ? 'dark' : 'light';
      apply(t, true);
      setTheme(t);
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
