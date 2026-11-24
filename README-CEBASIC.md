# CeBasic Agent

Chat interno de IA de Cebasic / Credibasic. Es un fork de [LibreChat](https://github.com/danny-avila/LibreChat) (MIT).

```
Navegador → LibreChat (CeBasic Agent) → LiteLLM Proxy → OpenRouter → Claude / GPT / Gemini
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
   - En macOS: `UID=$(id -u)` y `GID=$(id -g)` con los números reales.
3. Arranca:
   ```bash
   docker compose up -d
   ```
4. Abre:
   - CeBasic Agent: http://localhost:3080
   - UI de LiteLLM: http://localhost:4000/ui (usuario `LITELLM_UI_USERNAME`, contraseña `LITELLM_UI_PASSWORD`)

### Crear usuarios

El registro abierto está apagado (`ALLOW_REGISTRATION=false`). Mientras no exista el login propio, los usuarios se crean así:

```bash
docker exec -it LibreChat npm run create-user -- correo@empresa.com "Nombre" usuario
```

El comando pide la contraseña. El primer usuario que se crea queda como ADMIN.

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

- Login propio de CeBasic, que reemplazará el login por email temporal.
- Rebrand visual más profundo (logo, colores). Espera la revisión del equipo.
