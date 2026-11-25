@echo off
chcp 65001 >nul
setlocal
REM ============================================================================
REM   Tran.IDE II — Bidirectional 1:1 Natural Language <-> Code IDE
REM   🄯 (c)카피레프트 Copyleft — Tran.IDE
REM   Copyright (C) 2026 Bakk jaejin (a Bakk jaejin production)
REM
REM   SPDX-License-Identifier: AGPL-3.0-or-later
REM   This program is free software: you can redistribute it and/or modify
REM   it under the terms of the GNU Affero General Public License as published by
REM   the Free Software Foundation, either version 3 of the License, or
REM   (at your option) any later version.
REM   See the LICENSE and NOTICE files or <https://www.gnu.org/licenses/>.
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
