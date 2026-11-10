#!/usr/bin/env bash
# Creates a consistent backup of the SQLite database and all uploads.
#   scripts/backup.sh [target-directory]   (default: ./backups)
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:-backups}"; STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TARGET"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# sqlite3's online backup API yields a consistent copy even while the app is running.
.venv/bin/python - "$TMP/refurbed_sail.db" <<'PY'
import sqlite3, sys
src = sqlite3.connect("data/refurbed_sail.db"); dst = sqlite3.connect(sys.argv[1])
with dst: src.backup(dst)
PY
tar -czf "$TARGET/refurbed-sail-$STAMP.tar.gz" -C "$TMP" refurbed_sail.db -C "$(pwd)" uploads
echo "Backup erstellt: $TARGET/refurbed-sail-$STAMP.tar.gz"
