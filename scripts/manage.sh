#!/usr/bin/env bash
# Wrapper for management commands, e.g.:
#   scripts/manage.sh create-admin
#   scripts/manage.sh seed-demo
set -euo pipefail
cd "$(dirname "$0")/../backend"
[ -f ../.env ] && { set -a; . ../.env; set +a; }
exec ../.venv/bin/python -m app.cli "$@"
