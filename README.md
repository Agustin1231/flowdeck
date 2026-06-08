# FlowDeck — Gestor multi-instancia de n8n

🌐 **Live demo:** [flowdeck.agustinynatalia.site](https://flowdeck.agustinynatalia.site)

Una **PWA** (instalable como app de escritorio/móvil) con **login** para administrar **varias
instancias de n8n** desde un solo lugar. Conectás cada n8n con su URL + API key y desde FlowDeck
podés:

- 📋 Listar y buscar **workflows**, ver su detalle (nodos, tags, JSON completo).
- 🔌 **Prender y apagar** workflows (activar / desactivar) con un switch.
- 📊 Ver **ejecuciones** con su estado, duración y datos completos.
- 📈 Un **resumen** por instancia (workflows activos, tasa de éxito, ejecuciones recientes).
- ➕ Agregar, editar y quitar instancias **desde la interfaz**.

Las API keys se guardan **cifradas en el servidor** (AES-256-GCM) y nunca llegan al navegador:
todas las llamadas a n8n pasan por el backend, que actúa de proxy.

---

## 🚀 Uso local (rápido)

Requiere **Node 20+**.

```bash
# 1. Instalar dependencias (servidor + frontend)
npm install
npm run install:web

# 2. Compilar la PWA
npm run build:web

# 3. Arrancar
npm start
```

Abrí **http://localhost:8080**. En el primer arranque vas a crear tu **cuenta de administrador**.
Después, tocá **“+ Conectar instancia”** y cargá:

- **Nombre**: cómo querés llamarla (p. ej. *n8n Producción*).
- **URL de n8n**: pegá la URL de tu n8n (p. ej. `https://n8n.tudominio.com`). FlowDeck encuentra
  la API solo (acepta también que pegues `.../home/workflows`).
- **API key**: la generás en n8n → **Settings → n8n API → Create an API key**.

FlowDeck valida la conexión contra tu n8n antes de guardarla.

> Los datos (tu cuenta + las instancias) se guardan en `./data/db.json` por defecto. Cambialo con
> la variable `DATA_DIR`.

### Modo desarrollo (hot reload)

En dos terminales:

```bash
npm run dev            # backend en :8080 (node --watch)
cd web && npm run dev  # frontend en :5173 (proxea /api → :8080)
```

---

## 📱 Instalar como app (PWA)

Una vez servida por HTTPS (o en `localhost`), el navegador ofrece **“Instalar app”**
(Chrome/Edge: ícono en la barra de direcciones; iOS Safari: *Compartir → Agregar a inicio*).
Queda como una app independiente, con su ícono, y funciona offline para la cáscara de la interfaz.

---

## 🐳 Deploy en Coolify (con volumen persistente)

FlowDeck trae `Dockerfile` y `docker-compose.yml` listos.

1. **Nuevo recurso** en Coolify → *Docker Compose* (o *Dockerfile*), apuntando a este repo.
2. **Volumen persistente**: montá un volumen en **`/data`**. Ahí viven la cuenta de admin y las
   instancias; sin volumen, se borran en cada deploy.
   - En `docker-compose.yml` ya está declarado `flowdeck-data:/data`.
3. **Puerto**: el contenedor expone **8080**. Coolify le pone el dominio/HTTPS por delante.
4. **Variables de entorno** (recomendado en producción — ver tabla abajo): definí `JWT_SECRET` y
   `APP_SECRET` para fijar los secretos. Si no los ponés, se generan y se guardan en el volumen.

```yaml
# docker-compose.yml (resumen)
services:
  flowdeck:
    build: .
    ports: ["8080:8080"]
    environment:
      - DATA_DIR=/data
      - JWT_SECRET=${JWT_SECRET:-}
      - APP_SECRET=${APP_SECRET:-}
    volumes:
      - flowdeck-data:/data
volumes:
  flowdeck-data:
```

> **Importante sobre `APP_SECRET`**: cifra las API keys en disco. Si lo definís y después lo
> cambiás, las keys guardadas dejan de poder descifrarse y vas a tener que recargarlas. Generá uno
> fijo de entrada: `openssl rand -hex 32`.

### Build manual con Docker

```bash
docker build -t flowdeck .
docker run -d -p 8080:8080 -v flowdeck-data:/data --name flowdeck flowdeck
```

---

## ⚙️ Variables de entorno

| Variable | Default | Para qué |
|---|---|---|
| `PORT` | `8080` | Puerto HTTP del servidor. |
| `DATA_DIR` | `./data` | Carpeta de datos. Montá un volumen acá en Coolify. |
| `JWT_SECRET` | _(autogenerado)_ | Firma las sesiones. Definilo para fijarlas/rotarlas. |
| `APP_SECRET` | _(autogenerado)_ | Cifra las API keys en disco. |
| `ADMIN_USERNAME` | — | Crea el admin en el primer arranque sin pasar por la pantalla de setup. |
| `ADMIN_PASSWORD` | — | Contraseña del admin (junto con `ADMIN_USERNAME`). |

Todas son opcionales: sin ninguna, la app funciona y genera los secretos sola (los persiste en el
volumen). Ver `.env.example`.

---

## 🗂️ Estructura

```
flowdeck/
├── server/                # Backend Express (ESM, sin módulos nativos)
│   ├── index.js           # App: API + sirve la PWA + SPA fallback
│   ├── db.js              # Store JSON en DATA_DIR/db.json (atómico)
│   ├── auth.js            # Setup / login / sesión por cookie (JWT)
│   ├── crypto.js          # scrypt (passwords) + AES-256-GCM (API keys)
│   ├── n8n.js             # Cliente de la API de n8n + normalización de URL
│   └── routes/instances.js# CRUD de instancias + proxy a n8n
├── web/                   # Frontend React + Vite + PWA
│   └── src/
│       ├── pages/         # Login/Setup, Instancias, Detalle (Resumen/WF/Ejec.)
│       ├── components/    # UI, modales, formularios
│       └── lib/           # api, auth, toast, hooks, formato
├── scripts/gen-icons.mjs  # Genera los íconos PWA (sin dependencias)
├── Dockerfile             # Multi-stage: build web → runtime server
├── docker-compose.yml     # Deploy con volumen /data
└── .env.example
```

---

## 🔒 Notas de seguridad

- **Contraseñas**: hash con `scrypt` (`salt:hash`), nunca en texto plano.
- **Sesiones**: cookie `httpOnly` + `sameSite=lax`, firmada con JWT (`secure` en producción).
- **API keys de n8n**: cifradas con AES-256-GCM antes de tocar disco. El frontend nunca las recibe;
  el backend hace de proxy hacia n8n.
- Poné FlowDeck detrás de **HTTPS** (Coolify lo hace) para que las cookies viajen seguras.

## 🎨 Regenerar íconos

Los íconos PWA están en `web/public/icons`. Para regenerarlos (no necesita dependencias):

```bash
node scripts/gen-icons.mjs
```
