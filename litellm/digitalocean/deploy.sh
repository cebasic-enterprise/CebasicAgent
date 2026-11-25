#!/usr/bin/env bash
# Despliega/actualiza el stack de CeBasic Agent en el droplet (LiteLLM +
# LibreChat + login OIDC). No toca los secretos (.env, .env.librechat,
# .env.oidc), que viven solo en el servidor.
#
# Uso (desde la raíz de CebasicAgent, rama cebasic):
#   litellm/digitalocean/deploy.sh
# Variables opcionales:
#   DROPLET=root@24.199.99.67
#   OIDC_REPO=~/Desktop/Projects/traspasos/cebasicapi-node
#   OIDC_REF=origin/feat/oidc-login
set -euo pipefail

DROPLET="${DROPLET:-root@24.199.99.67}"
OIDC_REPO="${OIDC_REPO:-$HOME/Desktop/Projects/traspasos/cebasicapi-node}"
OIDC_REF="${OIDC_REF:-origin/feat/oidc-login}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/litellm/digitalocean"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "→ Preparando archivos"
cp "$HERE"/{docker-compose.yml,Caddyfile,backup.sh} "$STAGE/"
cp "$ROOT/litellm/config.yaml" "$STAGE/config.yaml"
cp "$ROOT/librechat.yaml" "$STAGE/librechat.yaml"
mkdir -p "$STAGE/branding" "$STAGE/oidc/app"
cp "$ROOT"/branding/*.{png,svg} "$STAGE/branding/"
cp "$HERE"/oidc/{Dockerfile,.dockerignore} "$STAGE/oidc/"

echo "→ Código OIDC: $OIDC_REF de $OIDC_REPO"
git -C "$OIDC_REPO" fetch -q origin
git -C "$OIDC_REPO" archive "$OIDC_REF" | tar -x -C "$STAGE/oidc/app"
git -C "$OIDC_REPO" rev-parse --short "$OIDC_REF" > "$STAGE/oidc/REVISION"

echo "→ Copiando a $DROPLET:/opt/litellm"
rsync -az --delete-after \
  --exclude '.env' --exclude '.env.*' --exclude 'backups/' \
  "$STAGE/" "$DROPLET:/opt/litellm/"

echo "→ Levantando"
ssh "$DROPLET" 'cd /opt/litellm && docker compose up -d --build --remove-orphans && docker compose ps --format "{{.Service}}\t{{.Status}}"'
