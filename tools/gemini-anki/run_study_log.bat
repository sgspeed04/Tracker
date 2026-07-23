@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1

python "%~dp0run_all_logs.py"

pause
