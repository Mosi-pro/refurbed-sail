#!/usr/bin/env bash
# REFURBED SAIL – starts backend (FastAPI/Uvicorn) and frontend (Vite).
#   ./start.sh         production-like: builds the frontend and serves the build
#   ./start.sh dev     development: hot reload for backend and frontend
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
MODE="${1:-prod}"
mkdir -p run logs data uploads

if [ ! -f .env ]; then
  cp .env.example .env
  KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  sed -i "s|^RS_SECRET_KEY=.*|RS_SECRET_KEY=${KEY}|" .env
  chmod 600 .env
  echo "→ .env wurde mit einem zufälligen RS_SECRET_KEY angelegt."
fi
set -a; . ./.env; set +a
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"; FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"; BACKEND_PORT="${BACKEND_PORT:-8000}"
export FRONTEND_HOST FRONTEND_PORT BACKEND_HOST BACKEND_PORT

for f in run/backend.pid run/frontend.pid; do
  if [ -f "$f" ] && kill -0 "$(cat "$f")" 2>/dev/null; then
    echo "REFURBED SAIL läuft bereits (PID $(cat "$f")). Zuerst ./stop.sh ausführen." >&2; exit 1
  fi
done

if [ ! -x .venv/bin/python ]; then
  echo "→ Python-Umgebung wird eingerichtet …"
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install --quiet -r backend/requirements.txt
fi
if [ ! -d frontend/node_modules ]; then
  echo "→ Frontend-Abhängigkeiten werden installiert …"
  (cd frontend && npm install --no-audit --no-fund --silent)
fi

echo "→ Datenbankmigrationen …"
(cd backend && ../.venv/bin/alembic upgrade head 2>>"$ROOT/logs/backend.log")

RELOAD=""; [ "$MODE" = "dev" ] && RELOAD="--reload"
(cd backend && exec setsid ../.venv/bin/uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" \
  --proxy-headers --forwarded-allow-ips 127.0.0.1 $RELOAD >>"$ROOT/logs/backend.log" 2>&1) &
echo $! > run/backend.pid

if [ "$MODE" = "dev" ]; then
  (cd frontend && exec setsid npx vite >>"$ROOT/logs/frontend.log" 2>&1) &
else
  if [ ! -f frontend/dist/index.html ] || [ -n "$(find frontend/src frontend/index.html frontend/public -newer frontend/dist/index.html -print -quit)" ]; then
    echo "→ Frontend wird gebaut …"
    (cd frontend && npm run build >>"$ROOT/logs/frontend.log" 2>&1) || { echo "Frontend-Build fehlgeschlagen, siehe logs/frontend.log" >&2; ./stop.sh >/dev/null; exit 1; }
  fi
  (cd frontend && exec setsid npx vite preview >>"$ROOT/logs/frontend.log" 2>&1) &
fi
echo $! > run/frontend.pid

HEALTH_HOST="$BACKEND_HOST"; [ "$HEALTH_HOST" = "0.0.0.0" ] && HEALTH_HOST="127.0.0.1"
for _ in $(seq 1 40); do
  if curl -fsS --noproxy '*' "http://${HEALTH_HOST}:${BACKEND_PORT}/api/health" >/dev/null 2>&1 \
     && curl -fsS --noproxy '*' -o /dev/null "http://127.0.0.1:${FRONTEND_PORT}/" 2>/dev/null; then
    echo
    echo "REFURBED SAIL läuft ($MODE)."
    echo "  Website:   http://localhost:${FRONTEND_PORT}"
    echo "  API:       http://${HEALTH_HOST}:${BACKEND_PORT}/api/health"
    if [ "$FRONTEND_HOST" = "0.0.0.0" ]; then
      IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
      echo "  Im LAN:    http://${IP:-<IP-dieses-Rechners>}:${FRONTEND_PORT}"
      echo "  Hinweis:   Nur im vertrauenswürdigen lokalen Netz verwenden, nicht ins Internet freigeben."
    fi
    echo "  Logs:      logs/backend.log, logs/frontend.log   ·   Stoppen: ./stop.sh"
    exit 0
  fi
  sleep 0.5
done
echo "Start fehlgeschlagen. Siehe logs/backend.log und logs/frontend.log." >&2
./stop.sh >/dev/null || true
exit 1
