@echo off
setlocal

echo Installed WSL distributions:
wsl.exe --list --quiet
set "DISTRO="
set /p "DISTRO=Enter the exact WSL distribution name shown above: "
if not defined DISTRO (
  echo No WSL distribution name was entered.
  pause
  exit /b 1
)

set "WSL_READY="
for /f "delims=" %%A in ('wsl.exe -d "%DISTRO%" --exec /bin/echo MGPS_WSL_READY 2^>nul') do (
  if "%%A"=="MGPS_WSL_READY" set "WSL_READY=1"
)
if not defined WSL_READY (
  echo.
  echo WSL distribution "%DISTRO%" was not found or could not start.
  echo Choose an installed Ubuntu distribution from the list above.
  pause
  exit /b 1
)

echo Starting MGPS ERP services in WSL (%DISTRO%)...
wsl.exe -d "%DISTRO%" -u root -- systemctl start postgresql mgps-erp
if errorlevel 1 (
  echo.
  echo Could not start PostgreSQL and the ERP backend.
  echo Check that WSL systemd is enabled and that the mgps-erp service is installed.
  pause
  exit /b 1
)

echo Checking for a Cloudflare Tunnel service...
wsl.exe -d "%DISTRO%" -u root -- bash -lc "if systemctl cat cloudflared.service >/dev/null 2>&1; then systemctl start cloudflared.service && echo Cloudflare Tunnel service started.; else echo No cloudflared.service found; public access may need the tunnel started separately.; fi"

echo.
echo Waiting for the ERP API health check...
wsl.exe -d "%DISTRO%" -u root -- bash -lc "for attempt in $(seq 1 30); do if curl --fail --silent http://127.0.0.1:5000/api/health | grep -q '\"database\":\"connected\"'; then echo ERP backend is healthy: http://127.0.0.1:5000/api/health; exit 0; fi; sleep 2; done; echo ERP backend did not become healthy. Check: systemctl status mgps-erp; exit 1"
if errorlevel 1 (
  echo.
  echo ERP startup did not complete successfully. In Ubuntu, run:
  echo   sudo systemctl status mgps-erp
  echo   sudo journalctl -u mgps-erp -n 50 --no-pager
  pause
  exit /b 1
)

echo.
echo ERP backend is ready. This window can stay open or be closed.
pause
