#!/bin/sh
# Arranque de LiteLLM en Heroku (lo usa Dockerfile.heroku).
# Heroku asigna $PORT y Heroku Postgres exige SSL.
set -e
case "$DATABASE_URL" in
  *sslmode=*) ;;
  ?*) export DATABASE_URL="${DATABASE_URL}?sslmode=require" ;;
esac
exec litellm --config /app/config.yaml --port "${PORT:-4000}" --num_workers 1
