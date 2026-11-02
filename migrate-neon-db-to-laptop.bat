@echo off
setlocal

echo This copies Neon data to the laptop's local PostgreSQL database.
echo The laptop database will be replaced after protected backups are created.
echo Neon will not be modified.
echo Backups will be stored in WSL under ~/erp-migration-backups.
echo.
wsl.exe --exec /bin/true
if errorlevel 1 (
  echo.
  echo The default WSL distribution could not start.
  echo Run "wsl --list --verbose" in PowerShell and check the distro marked with *.
  pause
  exit /b 1
)

choice /C YN /M "Continue"
if errorlevel 2 exit /b 0

wsl.exe -- bash -lc "cd \"$HOME/Marigold-Secondary-School-ERP-System\" && git pull --ff-only && node backend/scripts/migrateNeonPostgresToLaptop.js"
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
