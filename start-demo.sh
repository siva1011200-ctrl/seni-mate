#!/usr/bin/env bash
# SeniMate - start everything (Linux / macOS)
set -e
cd "$(dirname "$0")"

if [ ! -x backend/.venv/bin/python ]; then
  echo "Setting up backend virtualenv..."
  python3 -m venv backend/.venv
  backend/.venv/bin/python -m pip install -r backend/requirements.txt
fi

if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi

echo "Resetting and seeding demo data..."
backend/.venv/bin/python backend/seed.py --reset

echo "Starting backend on http://localhost:8000 ..."
(cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT INT TERM

echo ""
echo "SeniMate is starting. Open http://localhost:5173 in your browser."
echo "Press Ctrl+C to stop both servers."
wait
