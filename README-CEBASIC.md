# CeBasic Agent

Chat interno de IA de Cebasic / Credibasic. Es un fork de [LibreChat](https://github.com/danny-avila/LibreChat) (MIT).

```
Navegador → LibreChat (CeBasic Agent) → LiteLLM Proxy → OpenRouter → Claude / GPT / Gemini
                 │
                 └─ login ─→ cebasicapi-node (/oidc, OpenID Connect) → SQL Server Ctl_Usuarios
```

- **LibreChat** solo conoce a LiteLLM, a través del endpoint propio `CeBasic` de `librechat.yaml`.
- **LiteLLM** guarda las claves virtuales, los presupuestos y los logs de gasto en su propio Postgres (`litellm-db`), y es el único que tiene la clave de OpenRouter.
- Los cambios de la empresa viven en la rama `cebasic`. `main` es una copia limpia de upstream.

## Archivos propios

| Archivo | Para qué |
|---|---|
| `docker-compose.override.yml` | Agrega `litellm` y `litellm-db`, monta `librechat.yaml` y usa la imagen de release numerado |
| `litellm/config.yaml` | Modelos (alias → id de OpenRouter) |
| `librechat.yaml` | Endpoint `CeBasic`, opciones de interfaz y registro |
| `.env.example` | El bloque "CeBasic Agent" al final tiene las variables nuevas y las que cambian |
| `README-CEBASIC.md` | Este archivo |

`librechat.yaml` y `docker-compose.override.yml` están en el `.gitignore` de upstream. Por eso se agregaron con `git add -f`. Ya están rastreados, así que los cambios se ven normal en `git status`.

## Levantar en local

Requisitos: Docker Desktop.

1. Crea `.env`:
   ```bash
   cp .env.example .env
   ```
2. Llena en `.env`:
   - `CREDS_KEY` (64 hex), `CREDS_IV` (32 hex), `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MEILI_MASTER_KEY`, `ADMIN_PANEL_SESSION_SECRET`. Puedes usar `openssl rand -hex 32`, y `-hex 16` para `CREDS_IV`.
   - `LITELLM_MASTER_KEY` y `LITELLM_SALT_KEY` (deben empezar con `sk-`), `LITELLM_DB_PASSWORD`, `LITELLM_UI_PASSWORD`.
   - `LITELLM_API_KEY`: para arrancar, igual a `LITELLM_MASTER_KEY`. Después cámbiala por una virtual key (ver abajo).
   - `OPENROUTER_API_KEY`: tu clave de OpenRouter.
   - Las variables `OPENID_*` del login con CeBasic (ver abajo).
   - En macOS: `UID=$(id -u)` y `GID=$(id -g)` con los números reales.
3. Arranca:
   ```bash
   docker compose up -d
   ```
4. Abre:
   - CeBasic Agent: http://localhost:3080
   - UI de LiteLLM: http://localhost:4000/ui (usuario `LITELLM_UI_USERNAME`, contraseña `LITELLM_UI_PASSWORD`)

### Login con CeBasic (OpenID Connect)

Se entra con el mismo usuario y contraseña de la app **cebasicwork** (tabla `Ctl_Usuarios`). El proveedor OpenID es `cebasicapi-node` (carpeta `src/oidc`, rama `feat/oidc-login`), que muestra su propia página "CeBasic Agent". LibreChat no tiene cambios de código: todo es configuración.

- Es el **único** acceso: la pantalla de login de LibreChat manda directo al login de CeBasic (`OPENID_AUTO_REDIRECT=true`). El login por correo y el registro están apagados (`ALLOW_EMAIL_LOGIN=false`, `ALLOW_REGISTRATION=false`) y `POST /api/auth/login` responde 403. No definas `ALLOW_EMAIL_LOGIN_OVERRIDE`.
- La cuenta de LibreChat se crea sola la primera vez (`ALLOW_SOCIAL_REGISTRATION=true`).
- Sólo entran usuarios activos: `bEstatus = 0` (en `Ctl_Usuarios` el 1 es baja) y `bBloqueado` distinto de 1. Un usuario dado de baja ya no puede iniciar sesión (la sesión de LibreChat que ya tenga abierta dura hasta que expire).
- `bAdministrador = 1` (o estar en `ADMIN_USERS` de cebasicapi-node) → rol **ADMIN** en LibreChat. Si se lo quitan, vuelve a USER en su siguiente login.
- El correo es sintético: `{usuario}@cebasic.local` (LibreChat necesita un correo).
- El proveedor siempre pide la contraseña, aunque se haya entrado antes en el mismo navegador (equipos compartidos en sucursal).
- Tras 5 fallos seguidos el usuario queda bloqueado 15 minutos.

Variables en `.env` (bloque "CeBasic Agent"):

| Variable | Valor |
|---|---|
| `OPENID_ISSUER` | `OIDC_ISSUER` de cebasicapi-node, p.ej. `https://<app>.herokuapp.com/oidc`. **Debe ser https.** |
| `OPENID_CLIENT_ID` / `OPENID_CLIENT_SECRET` | Iguales a `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` de cebasicapi-node |
| `OPENID_SESSION_SECRET` | `openssl rand -hex 32` |
| `OPENID_SCOPE` | `"openid profile email roles"` |
| `OPENID_USE_PKCE` | `true` (el proveedor lo exige) |
| `OPENID_ADMIN_ROLE` / `_PARAMETER_PATH` / `_TOKEN_KIND` | `admin` / `roles` / `userinfo` |

En cebasicapi-node, `OIDC_REDIRECT_URIS` debe incluir `DOMAIN_SERVER` + `/oauth/openid/callback` (en local `http://localhost:3080/oauth/openid/callback`).

#### Probar en local

LibreChat sólo acepta un proveedor con **https**, y el contenedor no ve el `localhost` de la Mac. Lo más simple es un túnel temporal hacia cebasicapi-node:

1. En `cebasicapi-node`: llena `DB_*` en `.env`, genera los secretos con `node scripts/generate-oidc-keys.js >> .env` y arranca con `npm start` (puerto 3000).
2. Abre el túnel y copia la URL `https://….trycloudflare.com` que imprime:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. En `cebasicapi-node/.env`: `OIDC_ENABLED=true` y `OIDC_ISSUER=https://….trycloudflare.com/oidc`. Reinicia `npm start`.
4. En este `.env`: `OPENID_ISSUER` con la misma URL y `OPENID_CLIENT_SECRET` igual a `OIDC_CLIENT_SECRET`. Aplica:
   ```bash
   docker compose up -d api
   ```
5. Abre http://localhost:3080 → **Entrar con CeBasic**.

La URL de `trycloudflare` cambia cada vez que abres el túnel: actualiza las dos variables. Cierra el túnel al terminar.

#### Administradores

Las cuentas creadas antes con `npm run create-user` (p.ej. `admin@cebasic.local`) ya no pueden entrar. Para ser ADMIN en CeBasic Agent:

- Tener `bAdministrador = 1` en `Ctl_Usuarios`, **o**
- Agregar el usuario (`cCve_Usuario`) a `ADMIN_USERS` en el `.env` de cebasicapi-node y reiniciarlo.

El rol se aplica en el siguiente login. Emergencia: pon `ALLOW_EMAIL_LOGIN=true` y `OPENID_AUTO_REDIRECT=false` en `.env`, `docker compose restart api`, y revierte al terminar.

### Virtual keys y presupuestos (LiteLLM)

1. En http://localhost:4000/ui → *Virtual Keys* → *Create Key*. Ponle presupuesto, límites y los modelos permitidos.
2. Pega la clave en `LITELLM_API_KEY` dentro de `.env`.
3. Aplica el cambio:
   ```bash
   docker compose up -d api
   ```

LibreChat manda el id del usuario en el campo `user`. Así, LiteLLM registra el gasto por usuario final (*Usage* / *Logs*).

### Cambiar o agregar modelos

1. Edita `litellm/config.yaml`. Los ids actuales están en https://openrouter.ai/models.
2. Si agregaste un alias, súmalo a `models.default` en `librechat.yaml`.
3. Reinicia:
   ```bash
   docker compose restart litellm api
   ```

### Tema visual

`interface.theme` en `librechat.yaml` define el tema `cebasic`: la misma paleta que la UI de LiteLLM (grises de Tailwind, fuente Inter, botones casi negros y bordes gris claro), en modo claro y oscuro. Para ajustar un color, cambia su tripleta RGB y ejecuta `docker compose restart api`. Los nombres de los tokens están en `packages/data-provider/src/theme.ts`.

## LiteLLM en DigitalOcean (producción)

Droplet `cebasic-litellm` (sfo3, 2 GB / 1 vCPU, Ubuntu 24.04, IP `24.199.99.67`): **https://24-199-99-67.sslip.io** (`/ui` para el panel de admin).

- Archivos en `litellm/digitalocean/`: `cloud-init.yaml` (Docker, ufw 22/80/443, sin password SSH, 1 GB de swap), `docker-compose.yml` (Caddy con HTTPS automático + LiteLLM fijado por digest + Postgres 16), `Caddyfile`, `backup.sh` y `.env.example`.
- En el droplet todo vive en `/opt/litellm`; `.env` (chmod 600) tiene las llaves. Para ver una sin pegarla: `ssh root@24.199.99.67 grep UI_PASSWORD /opt/litellm/.env`.
- Solo Caddy publica puertos; LiteLLM (4000) y Postgres (5432) no son accesibles desde fuera.
- 1 GB no alcanza: LiteLLM usa ~860 MB con 1 worker.
- Respaldo diario 03:30 (`backup.sh`, cron de root) en `/opt/litellm/backups`, guarda 14 días. Restaurar: `gunzip -c backups/litellm-FECHA.sql.gz | docker compose exec -T litellm-db psql -U litellm litellm`.
- `LITELLM_SALT_KEY` **no se cambia** después del primer arranque (cifra las llaves guardadas).
- Dominio propio: crear registro A a la IP, cambiar `LITELLM_DOMAIN` en `/opt/litellm/.env` y `docker compose up -d caddy`.

Actualizar config o imagen:

```bash
scp litellm/config.yaml litellm/digitalocean/docker-compose.yml root@24.199.99.67:/opt/litellm/
ssh root@24.199.99.67 'cd /opt/litellm && docker compose up -d && docker compose restart litellm'
```

Crear de cero: `doctl compute droplet create cebasic-litellm --region sfo3 --size s-1vcpu-2gb --image ubuntu-24-04-x64 --user-data-file litellm/digitalocean/cloud-init.yaml --enable-monitoring`, copiar los archivos + `config.yaml` + `.env` a `/opt/litellm` y `docker compose up -d`.

## LiteLLM en Heroku (retirado)

La app `cebasic-litellm` de Heroku (Standard-2X + Postgres essential-0) se borró el 2026-11-24 al pasar a DigitalOcean.

### Marca (logo de cebasicwork)

`branding/` tiene los favicons, `logo.svg` y `cebasic-agent.png` (el icono del asistente). Todos salen del logo de cebasicwork. `docker-compose.override.yml` los monta encima de los assets públicos de LibreChat (`/app/client/dist/assets/`), así que no hace falta tocar código. Para cambiar el logo, reemplaza los archivos y ejecuta `docker compose up -d api`.

### App de escritorio (Mac y Windows)

Está en `desktop/`. Ahí están el README y los comandos para generar el `.dmg` y el `.exe`.

## Producción (droplet de DigitalOcean)

Todo corre en el droplet `cebasic-litellm` (24.199.99.67, 4 GB, sfo3), en `/opt/litellm`. La definición está en `litellm/digitalocean/`.

| URL | Servicio |
|---|---|
| https://agent.24-199-99-67.sslip.io | CeBasic Agent (LibreChat) |
| https://login.24-199-99-67.sslip.io/oidc | Login de CeBasic (OIDC). Solo se publica `/oidc` |
| https://24-199-99-67.sslip.io | LiteLLM (API y `/ui`) |

- **Caddy:** pone HTTPS (Let's Encrypt) a los tres dominios. Es el único servicio que abre puertos.
- **LibreChat:** usa MongoDB, sin Meilisearch ni RAG.
- **LiteLLM:** LibreChat se conecta con la virtual key `cebasic-agent-librechat`.
- **OIDC:** el código es la rama `feat/oidc-login` de cebasicapi-node (PR #6). Corre en un contenedor aparte, con Redis local. **No toca el Heroku de cebasicwork**: su `/auth/:user/:pass` sigue igual. Lee `Ctl_Usuarios` del mismo SQL Server.
- **Secretos:** solo existen en el droplet, nunca en git: `.env` (LiteLLM y dominios), `.env.librechat` y `.env.oidc` (con las credenciales del SQL Server). El `OPENID_CLIENT_SECRET` de LibreChat es igual al `OIDC_CLIENT_SECRET` del OIDC.
- **Respaldos:** `backup.sh` corre diario a las 03:30 y guarda 14 días: Postgres de LiteLLM y Mongo de LibreChat.

Actualizar (código, config o rama del OIDC):

```bash
litellm/digitalocean/deploy.sh
```

Cambiar de dominio (por ejemplo a uno propio):

1. Edita `AGENT_DOMAIN` y `LOGIN_DOMAIN` en `/opt/litellm/.env`.
2. Edita `DOMAIN_CLIENT`, `DOMAIN_SERVER` y `OPENID_ISSUER` en `.env.librechat`.
3. Edita `OIDC_ISSUER`, `OIDC_REDIRECT_URIS` y `OIDC_POST_LOGOUT_REDIRECT_URIS` en `.env.oidc`.
4. Ejecuta `docker compose up -d`.
5. Cambia `defaultServerUrl` en `desktop/package.json` y vuelve a generar los instaladores.

## Sincronizar con upstream

```bash
git fetch upstream
git checkout main && git merge --ff-only upstream/main && git push origin main
git checkout cebasic && git merge main
docker compose pull && docker compose up -d
```

- Si hay conflicto en `.env.example`, conserva el bloque "CeBasic Agent" al final.
- Revisa `UPGRADING.md` de upstream y el `version:` de `librechat.example.yaml`. Si sube, actualiza `version:` en `librechat.yaml`.

## Pendiente

- Publicar el proveedor OIDC en Heroku (cebasicapi-node con Heroku Redis y `OIDC_*`) y apuntar `OPENID_ISSUER` ahí.
- Rebrand visual más profundo (logo, colores). Espera la revisión del equipo.
