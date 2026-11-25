#!/bin/sh
# Respaldo diario (cron 03:30 en el droplet). Guarda 14 días.
#   - BD de LiteLLM (claves virtuales, gasto)
#   - MongoDB de LibreChat (usuarios y conversaciones de CeBasic Agent)
set -e
cd /opt/litellm
mkdir -p backups
docker compose exec -T litellm-db pg_dump -U litellm litellm | gzip > "backups/litellm-$(date +%F).sql.gz"
docker compose exec -T mongodb mongodump --archive --gzip --db LibreChat > "backups/librechat-$(date +%F).archive.gz"
find backups -name 'litellm-*.sql.gz' -mtime +14 -delete
find backups -name 'librechat-*.archive.gz' -mtime +14 -delete
