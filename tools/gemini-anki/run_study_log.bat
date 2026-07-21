@echo off
setlocal

set SCRIPT_DIR=%~dp0
set LOG_FILE=%SCRIPT_DIR%study_log.md

if not exist "%LOG_FILE%" (
    echo study_log.md 파일이 없습니다: %LOG_FILE%
    echo study_log.example.md를 study_log.md로 복사한 뒤 내용을 채워주세요.
    pause
    exit /b 1
)

if "%GEMINI_API_KEY%"=="" (
    echo GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.
    echo aistudio.google.com 에서 무료로 키를 발급받아 시스템 환경변수로 등록하세요.
    pause
    exit /b 1
)

python "%SCRIPT_DIR%study_log_to_anki.py" "%LOG_FILE%" --ai --deck "Gemini 학습"

echo.
pause
