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

if exist "%APP_DIR%Tran.IDE II.exe" (
    start "" "%APP_DIR%Tran.IDE II.exe" %*
    exit /b 0
)

if exist "%APP_DIR%runtimes\python\pythonw.exe" (
    start "" "%APP_DIR%runtimes\python\pythonw.exe" "%APP_DIR%main.py" %*
    exit /b 0
)

set "VENV_PY=%APP_DIR%.venv\Scripts\python.exe"
set "VENV_PYW=%APP_DIR%.venv\Scripts\pythonw.exe"

if not exist "%VENV_PYW%" (
    echo [Tran.IDE II] First-time setup: creating virtual environment...
    where py >nul 2>nul
    if %errorlevel%==0 (
        py -3 -m venv "%APP_DIR%.venv"
    ) else (
        where python >nul 2>nul
        if errorlevel 1 (
            echo.
            echo [Error] Python 3.10+ was not found on PATH.
            echo - Download Python from https://www.python.org/downloads/
            echo - Or download Tran.IDE_II_v0.12_Setup.exe from GitHub Releases.
            echo.
            pause
            exit /b 1
        )
        python -m venv "%APP_DIR%.venv"
    )
    if errorlevel 1 (
        echo [Error] Failed to create .venv.
        pause
        exit /b 1
    )
)

"%VENV_PY%" -c "import webview, bottle, clr_loader, pythonnet" >nul 2>nul
if errorlevel 1 (
    echo [Tran.IDE II] Installing dependencies from requirements.txt...
    "%VENV_PY%" -m pip install --upgrade pip
    "%VENV_PY%" -m pip install -r "%APP_DIR%requirements.txt"
    if errorlevel 1 (
        echo [Error] Failed to install dependencies.
        pause
        exit /b 1
    )
)

start "" "%VENV_PYW%" "%APP_DIR%main.py" %*
exit /b 0
