@echo off
setlocal EnableDelayedExpansion

:: ─────────────────────────────────────────────────────────────────────────────
::  ClaimIQ — Windows launcher
::  Usage:
::    start.bat           Run backend + frontend dev servers
::    start.bat --index   Build the insurance PageIndex trees only
::    start.bat --setup   Create DB schema + install all deps, then exit
:: ─────────────────────────────────────────────────────────────────────────────

set "ROOT=%~dp0"
cd /d "%ROOT%"

:: Parse arguments
set "MODE=run"
if "%~1"=="--index" set "MODE=index"
if "%~1"=="--setup" set "MODE=setup"

:: ── Colour helpers (works on Windows 10+) ────────────────────────────────────
call :print_header

if "%MODE%"=="setup" goto :setup
if "%MODE%"=="index" goto :index
goto :run

:: ─────────────────────────────────────────────────────────────────────────────
:setup
echo [SETUP] Installing Python dependencies...
if not exist ".venv" (
    python -m venv .venv
    if errorlevel 1 ( echo ERROR: python not found. Install Python 3.11+ and add to PATH. & pause & exit /b 1 )
)
call .venv\Scripts\activate.bat
pip install -r backend\requirements.txt
pip install -r indexer\requirements.txt

echo.
echo [SETUP] Installing Node dependencies...
cd web
call npm install
cd ..

echo.
echo [SETUP] Creating database schema...
if not exist ".env" (
    echo ERROR: .env not found. Copy .env.example to .env and fill in DATABASE_URL.
    pause & exit /b 1
)
for /f "tokens=1,* delims==" %%A in ('findstr /i "DATABASE_URL" .env') do set "DATABASE_URL=%%B"
if "!DATABASE_URL!"=="" (
    echo ERROR: DATABASE_URL not set in .env
    pause & exit /b 1
)
psql !DATABASE_URL! -f db\schema.sql
if errorlevel 1 (
    echo ERROR: Could not apply schema. Make sure PostgreSQL is running and DATABASE_URL is correct.
    pause & exit /b 1
)

echo.
echo [SETUP] Done. Run  start.bat  to launch the app.
pause
exit /b 0

:: ─────────────────────────────────────────────────────────────────────────────
:index
echo [INDEX] Building insurance PageIndex trees...
echo.
if not exist ".venv" (
    echo ERROR: Virtual env not found. Run  start.bat --setup  first.
    pause & exit /b 1
)
call .venv\Scripts\activate.bat
python indexer\build_index.py
if errorlevel 1 (
    echo ERROR: Indexer failed. Check that InsuranceData\ exists and OPENAI_BASE_URL is reachable.
    pause & exit /b 1
)
echo.
echo [INDEX] Done. Tree index written to indexer\tree_index\
pause
exit /b 0

:: ─────────────────────────────────────────────────────────────────────────────
:run
:: Check .env exists
if not exist ".env" (
    echo ERROR: .env not found.
    echo Copy .env.example to .env and configure your settings.
    echo.
    pause & exit /b 1
)

:: Activate venv
if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Virtual env not found. Run  start.bat --setup  first.
    pause & exit /b 1
)
call .venv\Scripts\activate.bat

:: Check node_modules
if not exist "web\node_modules" (
    echo [INFO] node_modules not found, running npm install...
    cd web & call npm install & cd ..
)

echo.
echo  Starting ClaimIQ...
echo.

:: ── Launch backend in a new window ───────────────────────────────────────────
start "ClaimIQ Backend" cmd /k "cd /d %ROOT% && call .venv\Scripts\activate.bat && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

:: Small delay so backend starts before frontend
timeout /t 2 /nobreak >nul

:: ── Launch frontend in a new window ──────────────────────────────────────────
start "ClaimIQ Frontend" cmd /k "cd /d %ROOT%\web && npm run dev"

:: ── Open browser after brief delay ───────────────────────────────────────────
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  ┌──────────────────────────────────────────┐
echo  │  Backend   →  http://localhost:8000       │
echo  │  Frontend  →  http://localhost:5173       │
echo  │  API docs  →  http://localhost:8000/docs  │
echo  │                                           │
echo  │  Close the Backend / Frontend windows     │
echo  │  to stop the servers.                     │
echo  └──────────────────────────────────────────┘
echo.
pause
exit /b 0

:: ─────────────────────────────────────────────────────────────────────────────
:print_header
echo.
echo  ██████╗██╗      █████╗ ██╗███╗   ███╗    ██╗ ██████╗
echo  ██╔════╝██║     ██╔══██╗██║████╗ ████║    ██║██╔═══██╗
echo  ██║     ██║     ███████║██║██╔████╔██║    ██║██║   ██║
echo  ██║     ██║     ██╔══██║██║██║╚██╔╝██║    ██║██║▄▄ ██║
echo  ╚██████╗███████╗██║  ██║██║██║ ╚═╝ ██║    ██║╚██████╔╝
echo   ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝    ╚═╝ ╚══▀▀═╝
echo.
echo  Insurance Claim RCM Tool  ^|  Powered by Gemma 4 12B
echo  ────────────────────────────────────────────────────
echo.
exit /b 0
