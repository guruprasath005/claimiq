#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Parse arguments ───────────────────────────────────────────────────────────
MODE="run"
if [[ "$1" == "--setup" ]]; then MODE="setup"; fi
if [[ "$1" == "--index" ]]; then MODE="index"; fi

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo "  Stobaeus Docx — Insurance Claim RCM Tool"
echo "  ─────────────────────────────────────────"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "setup" ]]; then
  echo "[SETUP] Creating Python virtual environment..."
  python3 -m venv "$ROOT/.venv"

  echo "[SETUP] Installing Python dependencies..."
  source "$ROOT/.venv/bin/activate"
  pip install -r "$ROOT/backend/requirements.txt"
  pip install -r "$ROOT/indexer/requirements.txt"

  echo "[SETUP] Installing Node dependencies..."
  cd "$ROOT/web" && npm install && cd "$ROOT"

  echo "[SETUP] Applying database schema..."
  if [[ ! -f "$ROOT/.env" ]]; then
    echo "ERROR: .env not found. Copy .env.example to .env and fill in DATABASE_URL."
    exit 1
  fi
  export $(grep -v '^#' "$ROOT/.env" | xargs)
  psql "$DATABASE_URL" -f "$ROOT/db/schema.sql"

  echo ""
  echo "  Setup complete. Run ./start.sh to launch."
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "index" ]]; then
  echo "[INDEX] Building insurance PageIndex trees..."
  if [[ ! -d "$ROOT/.venv" ]]; then
    echo "ERROR: Virtual env not found. Run ./start.sh --setup first."
    exit 1
  fi
  source "$ROOT/.venv/bin/activate"
  python3 "$ROOT/indexer/build_index.py"
  echo ""
  echo "  Index built → indexer/tree_index/"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# MODE = run

if [[ ! -f "$ROOT/.env" ]]; then
  echo "ERROR: .env not found. Copy .env.example to .env and configure it."
  exit 1
fi

# Activate venv if present, otherwise fall back to system python3
if [[ -f "$ROOT/.venv/bin/activate" ]]; then
  source "$ROOT/.venv/bin/activate"
else
  echo "[WARN] No .venv found — using system Python. Run ./start.sh --setup first."
fi

# Check node_modules
if [[ ! -d "$ROOT/web/node_modules" ]]; then
  echo "[INFO] node_modules not found, running npm install..."
  cd "$ROOT/web" && npm install && cd "$ROOT"
fi

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "  Stopping all services..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "  Done."
  exit 0
}
trap cleanup INT TERM

# ── Backend ───────────────────────────────────────────────────────────────────
echo "[1/2] Starting backend..."
cd "$ROOT"
python3 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Brief pause so backend is up before frontend starts
sleep 1

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "[2/2] Starting frontend..."
cd "$ROOT/web"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  Backend   →  http://localhost:8000          │"
echo "  │  Frontend  →  http://localhost:5173          │"
echo "  │  API docs  →  http://localhost:8000/docs     │"
echo "  │                                              │"
echo "  │  Press Ctrl+C to stop all services.          │"
echo "  └─────────────────────────────────────────────┘"
echo ""

wait
