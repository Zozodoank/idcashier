@echo off
REM Batch file untuk menjalankan npm run dev
REM Usage: run-dev.bat

echo Running npm run dev from project directory...
cd /d "%~dp0"
npm run dev

