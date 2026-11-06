# MGPS ERP blue-green deployment on the WSL server

The existing updater polls `main` and restarts the backend. The blue-green
workflow keeps the current backend running while it installs and health-checks
the new release, then switches Caddy's local API upstream. Cloudflare continues
to target the Caddy listener; it should not be changed after this migration.

## Requirements and behavior

- The WSL server, PostgreSQL, Cloudflare Tunnel, and internet connection must
  stay available. This is not a hosted service and cannot survive the laptop,
  power, WSL, or network being offline.
- The two backend slots share the same PostgreSQL database and environment.
  Database changes must remain backward-compatible while old and new processes
  overlap. Do not deploy destructive schema migrations as part of a blue-green
  release.
- PostgreSQL advisory locking prevents the daily event cleanup from running
  concurrently. The email outbox already uses `FOR UPDATE SKIP LOCKED`.
- HTTP requests continue through the old slot until the candidate health check
  passes and Caddy reloads. Existing WebSocket clients may reconnect during a
  switch; this is not a guarantee of zero interruption for Socket.IO clients.
- Releases are retained under `/var/lib/mgps-erp/releases`. Remove old worktrees
  only after confirming they are not referenced by either slot symlink.

## One-time migration

Only run these steps after this implementation is committed and pushed, the
existing two-minute updater has deployed that commit, and the repository on the
WSL server is clean and matches `origin/main`.

1. Verify the public API and current deployment:

   ```bash
   cd /home/parv/Marigold-Secondary-School-ERP-System
   git status --short --branch
   git rev-parse HEAD
   sudo cat /var/lib/mgps-erp-auto-update/deployed-commit
   curl -fsS https://api.marigoldschoolbehror.com/api/health
   ```

2. Verify Caddy routes port 8080 through the active upstream and that the
   tunnel's published application still targets `http://127.0.0.1:8080`.
   Do not run setup if the Cloudflare target is different.

3. Check available disk space (a second install of dependencies is required):

   ```bash
   df -h /var/lib
   ```

4. Initialize the blue slot. The script starts the candidate on port 5001,
   verifies PostgreSQL health, validates/reloads Caddy, verifies the proxy, and
   only then stops the legacy service. It keeps a dated Caddyfile backup.

   ```bash
   cd /home/parv/Marigold-Secondary-School-ERP-System
   sudo bash scripts/setup-blue-green-wsl.sh
   ```

5. Verify the new active slot and public route:

   ```bash
   sudo cat /var/lib/mgps-erp/active-slot
   sudo cat /var/lib/mgps-erp/active-commit
   systemctl status 'mgps-erp-slot@blue.service' --no-pager
   systemctl is-active mgps-erp-auto-update.timer
   curl -fsS http://127.0.0.1:8080/api/health
   curl -fsS https://api.marigoldschoolbehror.com/api/health
   ```

The setup leaves the Cloudflare tunnel target as Caddy at port 8080. It does
not modify secrets or print environment-file contents.

## Automatic deployment

The enabled systemd timer continues polling `main` approximately every two
minutes. A push or revert commit on `main` creates an isolated Git worktree,
installs its dependencies, links the existing backend environment file, starts
the inactive slot, checks database health, switches Caddy, verifies the
switched route, records the deployed commit, and drains/stops the previous
slot. A shared system lock prevents the timer, one-time migration, and manual
rollback from changing the upstream concurrently. A failed candidate or switch
leaves the existing slot serving traffic.

To follow deployment logs:

```bash
sudo journalctl -u mgps-erp-auto-update.service -f
```

## Roll back

To switch immediately to the other retained healthy slot:

```bash
cd /home/parv/Marigold-Secondary-School-ERP-System
sudo bash scripts/rollback-blue-green-wsl.sh
curl -fsS http://127.0.0.1:8080/api/health
```

This is an operational rollback only; it does not rewrite Git history or alter
the `main` branch. To keep the rollback as the intended code version, make a
normal revert commit on `main`. The timer will deploy that commit.
