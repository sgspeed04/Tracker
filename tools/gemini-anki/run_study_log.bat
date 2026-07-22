@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1

set SCRIPT_DIR=%~dp0

if "%GEMINI_API_KEY%"=="" (
    echo GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.
    echo aistudio.google.com 에서 무료로 키를 발급받아 시스템 환경변수로 등록하세요.
    pause
    exit /b 1
)

set FOUND=0

call :process "study_log.md" "Gemini 학습"
call :process "study_log_chinese.md" "중국어"
call :process "study_log_english.md" "영어"
call :process "study_log_bi.md" "BI"
call :process "study_log_python.md" "파이썬"

if "%FOUND%"=="0" (
    echo 처리할 로그 파일이 없습니다.
    echo study_log_*.example.md 파일들을 study_log_*.md로 복사한 뒤 내용을 채우고 다시 실행하세요.
)

echo.
pause
exit /b 0

:process
set "FILE=%SCRIPT_DIR%%~1"
if exist "%FILE%" (
    echo.
    echo === %~1  ->  덱: %~2 ===
    python "%SCRIPT_DIR%study_log_to_anki.py" "%FILE%" --ai --deck "%~2"
    set FOUND=1
)
exit /b 0
