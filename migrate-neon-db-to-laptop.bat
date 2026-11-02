@echo off
setlocal

set "DISTRO=Ubuntu-24.04"
set "PROJECT=Marigold-Secondary-School-ERP-System"

echo This copies Neon data to the laptop's local PostgreSQL database.
echo The laptop database will be replaced after protected backups are created.
echo Neon will not be modified.
echo Backups will be stored in WSL under ~/erp-migration-backups.
echo.
choice /C YN /M "Continue"
if errorlevel 2 exit /b 0

wsl.exe -d "%DISTRO%" -- bash -lc "cd \"$HOME/%PROJECT%\" && git pull --ff-only && node backend/scripts/migrateNeonPostgresToLaptop.js"
if errorlevel 1 (
  echo.
  echo Migration did not complete. Read the error above before retrying.
  pause
  exit /b 1
)

echo.
echo Neon-to-laptop migration completed and row counts were verified.
echo The backend was restarted on the laptop database.
pause
