#!/bin/sh
# Respaldo diario de la BD de LiteLLM (cron 03:30 en el droplet). Guarda 14 días.
set -e
cd /opt/litellm
docker compose exec -T litellm-db pg_dump -U litellm litellm | gzip > "backups/litellm-$(date +%F).sql.gz"
find backups -name 'litellm-*.sql.gz' -mtime +14 -delete
