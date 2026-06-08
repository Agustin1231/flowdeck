import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { hashPassword, verifyPassword, randomId } from './crypto.js';

const COOKIE_NAME = 'fd_session';
const SESSION_DAYS = 30;

function issueCookie(res, user) {
  const token = jwt.sign({ uid: user.id, username: user.username }, db.jwtSecret(), {
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

// Middleware: attaches req.user or responds 401.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, db.jwtSecret());
    const user = db.data.users.find((u) => u.id === payload.uid);
    if (!user) return res.status(401).json({ error: 'Sesión inválida' });
    req.user = { id: user.id, username: user.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada' });
  }
}

export const authRouter = express.Router();

// Lets the SPA decide what to render before showing anything sensitive.
authRouter.get('/status', (req, res) => {
  const needsSetup = db.data.users.length === 0;
  let authenticated = false;
  let username = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, db.jwtSecret());
      const user = db.data.users.find((u) => u.id === payload.uid);
      if (user) {
        authenticated = true;
        username = user.username;
      }
    } catch {
      /* ignore */
    }
  }
  res.json({ needsSetup, authenticated, username });
});

// First-run admin creation. Only allowed while no user exists.
authRouter.post('/setup', (req, res) => {
  if (db.data.users.length > 0) {
    return res.status(409).json({ error: 'La cuenta ya fue configurada' });
  }
  const { username, password } = req.body || {};
  if (!username || String(username).trim().length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const user = {
    id: randomId(),
    username: String(username).trim(),
    passwordHash: hashPassword(String(password)),
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  db.save();
  issueCookie(res, user);
  res.json({ username: user.username });
});

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.data.users.find(
    (u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase()
  );
  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  issueCookie(res, user);
  res.json({ username: user.username });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username });
});

authRouter.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.data.users.find((u) => u.id === req.user.id);
  if (!user || !verifyPassword(String(currentPassword || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  user.passwordHash = hashPassword(String(newPassword));
  db.save();
  issueCookie(res, user);
  res.json({ ok: true });
});

// Seed an admin from env vars on boot (handy for headless Coolify deploys).
export function seedAdminFromEnv() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  if (db.data.users.length > 0) return;
  db.data.users.push({
    id: randomId(),
    username: String(username).trim(),
    passwordHash: hashPassword(String(password)),
    createdAt: new Date().toISOString(),
  });
  db.save();
  console.log(`[auth] admin "${username}" creado desde variables de entorno`);
}
