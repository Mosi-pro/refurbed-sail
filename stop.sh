#!/usr/bin/env bash
# Stops backend and frontend started by start.sh.
cd "$(dirname "$0")"
stopped=0
for name in frontend backend; do
  f="run/$name.pid"
  [ -f "$f" ] || continue
  pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    kill -KILL -- "-$pid" 2>/dev/null || true
    echo "$name gestoppt (PID $pid)."
    stopped=1
  fi
  rm -f "$f"
done
[ "$stopped" = 1 ] || echo "REFURBED SAIL lief nicht."
