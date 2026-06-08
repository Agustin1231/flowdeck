// Dependency-free PWA icon generator. Renders a "flow graph" glyph on a
// diagonal gradient at 4x supersampling, box-downscales for anti-aliasing,
// and encodes real PNGs using only Node's built-in zlib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../web/public');
const ICONS = path.join(OUT, 'icons');
fs.mkdirSync(ICONS, { recursive: true });

const SS = 4; // supersample factor

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Draw the icon at hi-res into an RGBA buffer, then return it.
function renderHi(size, { inset = 0 } = {}) {
  const W = size * SS;
  const buf = Buffer.alloc(W * W * 4);
  const c1 = [43, 125, 233]; // blue-500  #2B7DE9
  const c2 = [21, 74, 181]; // blue-700  #154AB5

  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= W) return;
    const i = (y * W + x) * 4;
    const ia = a / 255;
    buf[i] = Math.round(lerp(buf[i], r, ia));
    buf[i + 1] = Math.round(lerp(buf[i + 1], g, ia));
    buf[i + 2] = Math.round(lerp(buf[i + 2], b, ia));
    buf[i + 3] = Math.max(buf[i + 3], a);
  };

  // Background: diagonal gradient, fully opaque (square; mask handles rounding).
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const t = (x + y) / (2 * W);
      const r = Math.round(lerp(c1[0], c2[0], t));
      const g = Math.round(lerp(c1[1], c2[1], t));
      const b = Math.round(lerp(c1[2], c2[2], t));
      const i = (y * W + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }

  // Glyph in unit coords (0..1), optionally inset for maskable safe-zone.
  const pad = inset;
  const U = (u) => (pad + u * (1 - 2 * pad)) * W;
  const white = [255, 255, 255];
  const soft = [255, 255, 255];

  const nodes = {
    A: [0.27, 0.31],
    B: [0.5, 0.52],
    C: [0.73, 0.72],
    D: [0.73, 0.3],
  };
  const edges = [['A', 'B'], ['B', 'C'], ['B', 'D']];
  const lineW = 0.032 * W * (1 - 2 * pad);
  const nodeR = 0.082 * W * (1 - 2 * pad);
  const ringR = 0.115 * W * (1 - 2 * pad);

  // Edges (thick anti-aliased segments).
  for (const [from, to] of edges) {
    const x0 = U(nodes[from][0]);
    const y0 = U(nodes[from][1]);
    const x1 = U(nodes[to][0]);
    const y1 = U(nodes[to][1]);
    const minX = Math.floor(Math.min(x0, x1) - lineW);
    const maxX = Math.ceil(Math.max(x0, x1) + lineW);
    const minY = Math.floor(Math.min(y0, y1) - lineW);
    const maxY = Math.ceil(Math.max(y0, y1) + lineW);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let t = ((x - x0) * dx + (y - y0) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = x0 + t * dx;
        const py = y0 + t * dy;
        const d = Math.hypot(x - px, y - py);
        const edge = lineW / 2;
        const a = d <= edge ? 1 : d <= edge + 1.5 ? (edge + 1.5 - d) / 1.5 : 0;
        if (a > 0) set(x, y, soft[0], soft[1], soft[2], Math.round(220 * a));
      }
    }
  }

  // Nodes: a translucent ring + solid core, for a bit of depth.
  for (const key of Object.keys(nodes)) {
    const cx = U(nodes[key][0]);
    const cy = U(nodes[key][1]);
    const maxR = ringR + 2;
    for (let y = Math.floor(cy - maxR); y <= Math.ceil(cy + maxR); y++) {
      for (let x = Math.floor(cx - maxR); x <= Math.ceil(cx + maxR); x++) {
        const d = Math.hypot(x - cx, y - cy);
        // ring
        if (d <= ringR + 1) {
          const ringEdge = Math.min(ringR - d, d - (ringR - lineW * 0.6));
          const aRing = Math.max(0, Math.min(1, ringEdge));
          if (aRing > 0) set(x, y, white[0], white[1], white[2], Math.round(90 * aRing));
        }
        // core
        const ac = d <= nodeR ? 1 : d <= nodeR + 1.5 ? (nodeR + 1.5 - d) / 1.5 : 0;
        if (ac > 0) set(x, y, white[0], white[1], white[2], Math.round(255 * ac));
      }
    }
  }

  return { buf, W };
}

// Box-downscale hi-res RGBA → target size RGBA.
function downscale(hi, W, size) {
  const out = Buffer.alloc(size * size * 4);
  const block = W / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = 0; sy < block; sy++) {
        for (let sx = 0; sx < block; sx++) {
          const hx = Math.floor(x * block + sx);
          const hy = Math.floor(y * block + sy);
          const i = (hy * W + hx) * 4;
          r += hi[i]; g += hi[i + 1]; b += hi[i + 2]; a += hi[i + 3]; n++;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// Round the corners of a square RGBA image (for non-maskable icons).
function roundCorners(rgba, size, radiusRatio = 0.22) {
  const radius = size * radiusRatio;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      if (x < radius && y < radius) { dx = radius - x; dy = radius - y; }
      else if (x >= size - radius && y < radius) { dx = x - (size - radius - 1); dy = radius - y; }
      else if (x < radius && y >= size - radius) { dx = radius - x; dy = y - (size - radius - 1); }
      else if (x >= size - radius && y >= size - radius) { dx = x - (size - radius - 1); dy = y - (size - radius - 1); }
      else continue;
      const d = Math.hypot(dx, dy);
      const o = (y * size + x) * 4;
      if (d > radius) rgba[o + 3] = 0;
      else if (d > radius - 1.5) rgba[o + 3] = Math.round(rgba[o + 3] * (radius - d) / 1.5);
    }
  }
  return rgba;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Filtered scanlines (filter byte 0 per row).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function writeIcon(file, size, opts = {}) {
  const { buf, W } = renderHi(size, opts);
  let rgba = downscale(buf, W, size);
  if (opts.round) rgba = roundCorners(rgba, size);
  fs.writeFileSync(file, encodePNG(rgba, size));
  console.log('  ✓', path.relative(OUT, file), `(${size}x${size})`);
}

console.log('Generando íconos PWA en', OUT);
writeIcon(path.join(ICONS, 'icon-192.png'), 192, { round: true });
writeIcon(path.join(ICONS, 'icon-512.png'), 512, { round: true });
writeIcon(path.join(ICONS, 'icon-512-maskable.png'), 512, { inset: 0.14 }); // full-bleed safe zone
writeIcon(path.join(OUT, 'apple-touch-icon.png'), 180, { round: true });

// Vector favicon (crisp at any size).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2B7DE9"/><stop offset="1" stop-color="#154AB5"/>
  </linearGradient></defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <g stroke="#fff" stroke-width="3.2" stroke-opacity="0.85" fill="none">
    <line x1="27" y1="31" x2="50" y2="52"/><line x1="50" y1="52" x2="73" y2="72"/><line x1="50" y1="52" x2="73" y2="30"/>
  </g>
  <g fill="#fff">
    <circle cx="27" cy="31" r="8"/><circle cx="50" cy="52" r="8"/><circle cx="73" cy="72" r="8"/><circle cx="73" cy="30" r="8"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);
console.log('  ✓ favicon.svg');
console.log('Listo.');
