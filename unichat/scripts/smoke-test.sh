#!/bin/bash
# Lance l'application réellement, sur un userData jetable, et vérifie qu'elle
# survit au démarrage.
#
# Le typecheck et les tests unitaires ne chargent jamais le main process : ils
# n'ont pas vu "contextMenu is not a function", un crash au lancement livré
# signé et notarisé dans les versions 1.4.0, 1.4.1 et 1.4.2 (2026-09-21).
#
# Usage : ./scripts/smoke-test.sh
set -u

cd "$(dirname "$0")/.." || exit 1

DATA_DIR="$(mktemp -d)"
LOG="$(mktemp)"
DELAY=15

cleanup() {
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null
  sleep 1
  rm -rf "$DATA_DIR" "$LOG"
}
trap cleanup EXIT

echo "Construction…"
npx electron-vite build > /dev/null 2>&1 || { echo "ÉCHEC : build"; exit 1; }

echo "Lancement sur données jetables (${DELAY}s)…"
nohup env UNICHAT_USER_DATA="$DATA_DIR" ./node_modules/.bin/electron . > "$LOG" 2>&1 &
APP_PID=$!
sleep "$DELAY"

if ! ps -p "$APP_PID" > /dev/null 2>&1; then
  echo "ÉCHEC : l'application s'est arrêtée avant ${DELAY}s"
  echo "--- log ---"
  tail -30 "$LOG"
  exit 1
fi

if grep -qE "Uncaught Exception|is not a function|Cannot find module" "$LOG"; then
  echo "ÉCHEC : exception au démarrage"
  grep -E "Uncaught Exception|is not a function|Cannot find module" "$LOG" | head -5
  exit 1
fi

echo "OK : application démarrée et stable après ${DELAY}s"
