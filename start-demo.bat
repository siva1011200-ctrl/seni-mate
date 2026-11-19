# SeniMate - start everything (Windows)
@echo off
setlocal
cd /d "%~dp0"

if not exist backend\.venv (
  echo Setting up backend virtualenv...
  python -m venv backend\.venv || exit /b 1
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || exit /b 1
)

if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  pushd frontend
  call npm install || (popd & exit /b 1)
  popd
)

echo Resetting and seeding demo data...
backend\.venv\Scripts\python.exe backend\seed.py --reset || exit /b 1

echo Starting backend on http://localhost:8000 ...
start "SeniMate Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

echo Starting frontend on http://localhost:5173 ...
start "SeniMate Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo SeniMate is starting. Open http://localhost:5173 in your browser.
echo Close the two new windows to stop the servers.
endlocal
