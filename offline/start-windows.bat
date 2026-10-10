@echo off
REM Офлайн-версия «Информатика»: локальный сервер для класса (Windows 10/11).
REM Открывает сайт в браузере. Закрытие окна останавливает сервер.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/
  py -3 -m http.server 8000
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/
  python -m http.server 8000
  exit /b
)
echo Python не найден. Установи Python с python.org (при установке поставь галочку Add to PATH)
echo или попроси учителя запустить сервер на своём компьютере.
pause
