import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { authRouter, seedAdminFromEnv } from './auth.js';
import { instancesRouter } from './routes/instances.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, '../web/dist');
const PORT = process.env.PORT || 8080;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ── API ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/instances', instancesRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));

// ── Static PWA + SPA fallback ──────────────────────────────────────────────
if (fs.existsSync(WEB_DIST)) {
  app.use(
    express.static(WEB_DIST, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
        // Never cache the service worker or HTML shell; hashed assets are immutable.
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/\/assets\//.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  // SPA fallback for client-side routes.
  app.get('*', (req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
} else {
  app.get('*', (req, res) =>
    res
      .status(200)
      .send(
        '<h1>FlowDeck</h1><p>El frontend todavía no está compilado. Ejecutá <code>npm run build:web</code>.</p>'
      )
  );
}

// Boot
seedAdminFromEnv();
app.listen(PORT, () => {
  console.log(`\n  FlowDeck escuchando en http://localhost:${PORT}`);
  console.log(`  Datos en: ${db.dbPath()}`);
  if (db.data.users.length === 0) {
    console.log('  → Primer arranque: abrí la app y creá la cuenta de administrador.\n');
  } else {
    console.log(`  → ${db.data.instances.length} instancia(s) configurada(s).\n`);
  }
});
