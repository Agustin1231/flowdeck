import fs from 'node:fs';
import path from 'node:path';
import { randomSecret } from './crypto.js';

// Minimal JSON-file store. The data lives in DATA_DIR (mount a volume there in
// Coolify so instances + the admin account persist across deploys). No native
// modules, so the Docker image needs no build toolchain.

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const DEFAULT_DB = {
  users: [],
  instances: [],
  settings: {},
};

let cache = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (cache) return cache;
  ensureDir();
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      cache = { ...structuredClone(DEFAULT_DB), ...JSON.parse(raw) };
    } catch (err) {
      console.error('[db] failed to parse db.json, starting fresh:', err.message);
      cache = structuredClone(DEFAULT_DB);
    }
  } else {
    cache = structuredClone(DEFAULT_DB);
  }
  // Ensure persistent secrets exist (used for JWT signing + key encryption).
  let changed = false;
  if (!cache.settings.jwtSecret) {
    cache.settings.jwtSecret = randomSecret();
    changed = true;
  }
  if (!cache.settings.appSecret) {
    cache.settings.appSecret = randomSecret();
    changed = true;
  }
  if (changed) persist();
  return cache;
}

function persist() {
  ensureDir();
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_PATH); // atomic replace
}

export const db = {
  get data() {
    return load();
  },
  save() {
    persist();
  },
  // Secrets: prefer env (lets you rotate/centralize), fall back to persisted.
  jwtSecret() {
    return process.env.JWT_SECRET || load().settings.jwtSecret;
  },
  appSecret() {
    return process.env.APP_SECRET || load().settings.appSecret;
  },
  dataDir() {
    return DATA_DIR;
  },
  dbPath() {
    return DB_PATH;
  },
};
