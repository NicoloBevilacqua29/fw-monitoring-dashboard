@echo off
chcp 65001 >nul
echo.
echo  NOC Scheduler — Build EXE
echo  ================================
echo.

cd /d "%~dp0"

:: Trova Python automaticamente
set PYTHON_EXE=
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Python313\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
    "C:\Program Files\Python313\python.exe"
    "C:\Program Files\Python312\python.exe"
) do (
    if exist %%P (
        set PYTHON_EXE=%%P
        goto :found_python
    )
)

:: Fallback: prova con 'py' launcher
where py >nul 2>&1
if not errorlevel 1 (
    set PYTHON_EXE=py
    goto :found_python
)

echo  ERRORE: Python non trovato. Installa Python da python.org
pause
exit /b 1

:found_python
echo  Python trovato: %PYTHON_EXE%
echo.

echo [1/3] Installo/verifico PyInstaller...
%PYTHON_EXE% -m pip install pyinstaller --quiet
if errorlevel 1 (
    echo  ERRORE durante installazione PyInstaller.
    pause
    exit /b 1
)

echo [2/3] Build in corso (potrebbe richiedere 1-2 minuti)...
%PYTHON_EXE% -m PyInstaller ^
  --onefile ^
  --noconsole ^
  --name "NOC_Scheduler" ^
  noc_scheduler.py

echo.
if exist "dist\NOC_Scheduler.exe" (
    copy /Y "dist\NOC_Scheduler.exe" "NOC_Scheduler.exe" >nul
    echo  [3/3] Fatto! NOC_Scheduler.exe pronto in questa cartella.
    echo.
    echo  Puoi spostare NOC_Scheduler.exe ovunque e lanciarlo con doppio click.
) else (
    echo  ERRORE: build fallita. Controlla i messaggi sopra.
)

echo.
pause
