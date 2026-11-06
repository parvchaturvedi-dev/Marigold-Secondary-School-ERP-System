#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="/etc/default/mgps-erp-auto-update"
STATE_DIR="/var/lib/mgps-erp-auto-update"
DEPLOY_DIR="/var/lib/mgps-erp"
CADDY_FILE="/etc/caddy/Caddyfile"
CADDY_UPSTREAM="/etc/caddy/mgps-active-upstream"
SLOT_UNIT="/etc/systemd/system/mgps-erp-slot@.service"

log() {
  printf '[mgps-erp-blue-green-setup] %s\n' "$*"
}

if [[ "${EUID}" -ne 0 ]]; then
  log "Run this setup script with sudo."
  exit 1
fi

exec 9>/run/lock/mgps-erp-deploy.lock
if ! flock -n 9; then
  log "Another deployment operation is in progress; refusing migration."
  exit 1
fi

if [[ ! -r "$CONFIG_FILE" ]]; then
  log "Missing updater configuration: $CONFIG_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"
if [[ -z "${PROJECT_DIR:-}" || -z "${DEPLOY_USER:-}" ]]; then
  log "PROJECT_DIR and DEPLOY_USER must be configured."
  exit 1
fi

if [[ -e "$STATE_DIR/blue-green-enabled" ]]; then
  log "Blue-green deployment is already initialized."
  exit 0
fi

if [[ "$(runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" branch --show-current)" != "main" ]] ||
  [[ -n "$(runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" status --porcelain --untracked-files=normal)" ]]; then
  log "The project checkout must be clean and on main before migration."
  exit 1
fi

if ! systemctl is-active --quiet mgps-erp.service; then
  log "The existing backend service is not active; refusing migration."
  exit 1
fi

if ! curl --fail --silent http://127.0.0.1:5000/api/health |
  grep -q '"database":"connected"'; then
  log "The current backend health check failed; refusing migration."
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/backend/.env" ]]; then
  log "The backend environment file is missing; refusing migration."
  exit 1
fi
if [[ "$(cat "$STATE_DIR/deployed-commit")" != "$(runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" rev-parse HEAD)" ]]; then
  log "The running deployment does not match the repository checkout; refusing migration."
  exit 1
fi

if [[ ! -f "$CADDY_FILE" ]] ||
  ! grep -qE 'reverse_proxy[[:space:]]+127\.0\.0\.1:5000([[:space:]]|$)' "$CADDY_FILE"; then
  log "Expected Caddy upstream to 127.0.0.1:5000 was not found; no files changed."
  exit 1
fi

commit="$(runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" rev-parse HEAD)"
group="$(id -gn "$DEPLOY_USER")"
install -d -o "$DEPLOY_USER" -g "$group" "$DEPLOY_DIR/releases" "$DEPLOY_DIR/slots"
install -d -o root -g root -m 0755 /etc/mgps-erp/slots

release_dir="$DEPLOY_DIR/releases/$commit"
if [[ ! -d "$release_dir" ]]; then
  runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" worktree add \
    --detach "$release_dir" "$commit"
fi
ln -sfn "$PROJECT_DIR/backend/.env" "$release_dir/backend/.env"
runuser -u "$DEPLOY_USER" -- /bin/bash -lc \
  'source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd "$1" && npm ci' \
  _ "$release_dir"

install -o root -g root -m 0644 \
  "$PROJECT_DIR/scripts/mgps-erp-slot@.service" "$SLOT_UNIT"
printf 'PORT=5001\n' >/etc/mgps-erp/slots/blue.env
printf 'PORT=5002\n' >/etc/mgps-erp/slots/green.env
chmod 0644 /etc/mgps-erp/slots/blue.env /etc/mgps-erp/slots/green.env

ln -sfn "$release_dir" "$DEPLOY_DIR/slots/blue"
ln -sfn "$release_dir" "$DEPLOY_DIR/slots/green"
systemctl daemon-reload
systemctl start mgps-erp-slot@blue.service

healthy=false
for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:5001/api/health |
    grep -q '"database":"connected"'; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  systemctl stop mgps-erp-slot@blue.service || true
  log "Candidate did not become healthy. The current backend is still active."
  exit 1
fi

systemctl enable mgps-erp-slot@blue.service >/dev/null

caddy_backup="${CADDY_FILE}.pre-blue-green.$(date +%Y%m%d-%H%M%S)"
cp "$CADDY_FILE" "$caddy_backup"
python3 - "$CADDY_FILE" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
contents = path.read_text()
old = "reverse_proxy 127.0.0.1:5000"
if contents.count(old) != 1:
    raise SystemExit("Expected exactly one existing Caddy backend upstream.")
path.write_text(contents.replace(old, "import /etc/caddy/mgps-active-upstream"))
PY

printf 'reverse_proxy 127.0.0.1:5001\n' >"$CADDY_UPSTREAM"
chmod 0644 "$CADDY_UPSTREAM"

if ! caddy validate --config "$CADDY_FILE" --adapter caddyfile; then
  cp "$caddy_backup" "$CADDY_FILE"
  rm -f "$CADDY_UPSTREAM"
  systemctl stop mgps-erp-slot@blue.service || true
  systemctl disable mgps-erp-slot@blue.service >/dev/null 2>&1 || true
  log "Caddy validation failed. The existing backend remains active."
  exit 1
fi

if ! systemctl reload caddy; then
  cp "$caddy_backup" "$CADDY_FILE"
  rm -f "$CADDY_UPSTREAM"
  systemctl reload caddy || true
  systemctl stop mgps-erp-slot@blue.service || true
  systemctl disable mgps-erp-slot@blue.service >/dev/null 2>&1 || true
  log "Caddy reload failed. The existing backend remains active."
  exit 1
fi

if ! curl --fail --silent http://127.0.0.1:8080/api/health |
  grep -q '"database":"connected"'; then
  cp "$caddy_backup" "$CADDY_FILE"
  rm -f "$CADDY_UPSTREAM"
  systemctl reload caddy
  systemctl stop mgps-erp-slot@blue.service || true
  systemctl disable mgps-erp-slot@blue.service >/dev/null 2>&1 || true
  log "Proxy health failed. The existing backend remains active."
  exit 1
fi

install -d -o root -g root -m 0755 "$STATE_DIR"
printf 'blue\n' >"$DEPLOY_DIR/active-slot"
printf '%s\n' "$commit" >"$DEPLOY_DIR/active-commit"
printf '%s\n' "$commit" >"$STATE_DIR/deployed-commit"
touch "$STATE_DIR/blue-green-enabled"
chmod 0644 "$DEPLOY_DIR/active-slot" "$DEPLOY_DIR/active-commit" \
  "$STATE_DIR/deployed-commit" "$STATE_DIR/blue-green-enabled"

sleep 15
systemctl stop mgps-erp.service
systemctl disable mgps-erp.service >/dev/null
log "Blue-green is initialized; blue slot serves traffic. Caddy backup: $caddy_backup"
