@echo off
cd /d "%~dp0"
echo Starting PET scanner local web server...
echo.
echo Open this address in your browser: http://localhost:8000
echo Press Ctrl+C here when you are finished.
echo.
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -m http.server 8000
) else (
    python -m http.server 8000
)
if errorlevel 1 echo Could not start Python. Install Python or run python -m http.server 8000 manually.
pause
