# ── Stage 1: build the PWA frontend ──────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
ENV NODE_ENV=development
RUN npm install
COPY web/ ./
RUN npm run build

# ── Stage 2: runtime (server + built assets) ────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

# Server dependencies only.
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=web /web/dist ./web/dist

# Persist account + instances here (mount a volume in Coolify).
VOLUME ["/data"]
EXPOSE 8080

# Lightweight healthcheck against the API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+ (process.env.PORT||8080) +'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
