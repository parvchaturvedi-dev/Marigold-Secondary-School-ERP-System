@echo off
setlocal

set "DISTRO=Ubuntu-24.04"
set "REPO=parvchaturvedi-dev/Marigold-Secondary-School-ERP-System"
set "PROJECT=Marigold-Secondary-School-ERP-System"

wsl.exe -l -q | findstr /I /C:"%DISTRO%" >nul
if errorlevel 1 (
  echo WSL distribution "%DISTRO%" was not found.
  echo Install it first with: wsl --install -d Ubuntu-24.04
  pause
  exit /b 1
)

echo This will install the ERP backend on Ubuntu WSL with a NEW, EMPTY local database.
echo It will not import or delete Neon data and will not create a public tunnel.
echo.
choice /C YN /M "Continue"
if errorlevel 2 exit /b 0

wsl.exe -d "%DISTRO%" -- bash -lc "set -e; if [ -d \"$HOME/%PROJECT%/.git\" ]; then cd \"$HOME/%PROJECT%\"; git pull --ff-only; else git clone \"https://github.com/%REPO%.git\" \"$HOME/%PROJECT%\"; cd \"$HOME/%PROJECT%\"; fi; bash scripts/setup-wsl-host.sh"
if errorlevel 1 (
  echo.
  echo Setup did not finish. Read the error above and run this file again after fixing it.
  pause
  exit /b 1
)

echo.
echo Local ERP backend setup finished.
echo The backend is not public yet. A secure tunnel and frontend API URL are separate steps.
pause
