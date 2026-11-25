@echo off
chcp 65001 >nul
setlocal
REM ============================================================================
REM   🄯 (c)카피레프트 Copyleft — Tran.IDE
REM   a Bakk jaejin production
REM   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
REM ============================================================================

set "APP_DIR=%~dp0"
set "PY_BIN="

if exist "%APP_DIR%.venv\Scripts\python.exe" (
    set "PY_BIN=%APP_DIR%.venv\Scripts\python.exe"
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        set "PY_BIN=python"
    ) else (
        where py >nul 2>nul
        if %errorlevel%==0 (
            set "PY_BIN=py -3"
        )
    )
)

if "%PY_BIN%"=="" (
    echo [Error] Python 3.10+ was not found on PATH.
    pause
    exit /b 1
)

echo [Tran.IDE II] Building portable package and Windows Setup.exe...
%PY_BIN% "%APP_DIR%scripts\build_installer.py" %*
if errorlevel 1 (
    echo.
    echo [Error] Build failed. See messages above.
    pause
    exit /b 1
)

echo.
echo [Done] Build outputs are in: "%APP_DIR%dist"
pause
exit /b 0
