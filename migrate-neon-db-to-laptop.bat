@echo off
setlocal

set "PROJECT=Marigold-Secondary-School-ERP-System"

echo This copies Neon data to the laptop's local PostgreSQL database.
echo The laptop database will be replaced after protected backups are created.
echo Neon will not be modified.
echo Backups will be stored in WSL under ~/erp-migration-backups.
echo.
wsl.exe --list --quiet
set "DISTRO="
set /p "DISTRO=Enter the exact WSL distribution name shown above: "
if not defined DISTRO (
  echo No WSL distribution name was entered.
  pause
  exit /b 1
)

wsl.exe -d "%DISTRO%" --exec /bin/true
if errorlevel 1 (
  echo.
  echo WSL distribution "%DISTRO%" was not found or could not start.
  echo Choose an installed Ubuntu distribution from the list above.
  pause
  exit /b 1
)

choice /C YN /M "Continue"
if errorlevel 2 exit /b 0

wsl.exe -d "%DISTRO%" -- bash -lc "cd \"$HOME/%PROJECT%\" && git pull --ff-only && node backend/scripts/migrateNeonPostgresToLaptop.js"
if errorlevel 1 goto migration_failed

echo.
echo Neon-to-laptop migration completed and row counts were verified.
echo The backend was restarted on the laptop database.
pause
exit /b 0

:migration_failed
  echo.
  echo Migration did not complete. Read the error above before retrying.
  pause
  exit /b 1
