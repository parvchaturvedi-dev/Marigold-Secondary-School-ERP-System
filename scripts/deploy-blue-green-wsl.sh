#!/usr/bin/env bash
set -Eeuo pipefail

CONFIG_FILE="/etc/default/mgps-erp-auto-update"
STATE_DIR="/var/lib/mgps-erp-auto-update"
DEPLOY_DIR="/var/lib/mgps-erp"
ACTIVE_SLOT_FILE="$DEPLOY_DIR/active-slot"
ACTIVE_COMMIT_FILE="$DEPLOY_DIR/active-commit"
BLUE_GREEN_MARKER="$STATE_DIR/blue-green-enabled"
CADDY_FILE="/etc/caddy/Caddyfile"
CADDY_UPSTREAM="/etc/caddy/mgps-active-upstream"

log() {
  printf '[mgps-erp-blue-green] %s\n' "$*"
}

if [[ "${EUID}" -ne 0 ]]; then
  log "Run this deployment script as root."
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

target_commit="${1:-}"
if [[ ! "$target_commit" =~ ^[0-9a-f]{40}$ ]]; then
  log "A full 40-character Git commit SHA is required."
  exit 1
fi

app_git() {
  runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" "$@"
}

if ! app_git cat-file -e "${target_commit}^{commit}" 2>/dev/null; then
  log "Target commit is not available in the repository checkout."
  exit 1
fi

if [[ "$(app_git rev-parse --show-toplevel)" != "$PROJECT_DIR" ]]; then
  log "Configured project directory is not a Git repository."
  exit 1
fi

if [[ ! -f "$CADDY_UPSTREAM" || ! -f "$ACTIVE_SLOT_FILE" ]]; then
  log "Blue-green deployment is not initialized. Run setup-blue-green-wsl.sh first."
  exit 1
fi

current_upstream="$(cat "$CADDY_UPSTREAM")"
case "$current_upstream" in
  "reverse_proxy 127.0.0.1:5001") active_slot="blue" ;;
  "reverse_proxy 127.0.0.1:5002") active_slot="green" ;;
  *)
    log "Caddy upstream does not point to a recognized backend slot."
    exit 1
    ;;
esac

if [[ "$(cat "$ACTIVE_SLOT_FILE")" != "$active_slot" ]]; then
  log "Correcting stale active-slot state from the live Caddy upstream."
  printf '%s\n' "$active_slot" >"${ACTIVE_SLOT_FILE}.new"
  mv -f "${ACTIVE_SLOT_FILE}.new" "$ACTIVE_SLOT_FILE"
fi

case "$active_slot" in
  blue) candidate_slot="green"; candidate_port=5002 ;;
  green) candidate_slot="blue"; candidate_port=5001 ;;
esac

release_dir="$DEPLOY_DIR/releases/$target_commit"
slot_link="$DEPLOY_DIR/slots/$candidate_slot"

install -d -o "$DEPLOY_USER" -g "$(id -gn "$DEPLOY_USER")" \
  "$DEPLOY_DIR/releases" "$DEPLOY_DIR/slots"

if [[ ! -d "$release_dir" ]]; then
  runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" worktree add \
    --detach "$release_dir" "$target_commit"
fi

if [[ ! -f "$PROJECT_DIR/backend/.env" ]]; then
  log "Shared backend environment file is missing; refusing deployment."
  exit 1
fi

if [[ -e "$release_dir/backend/.env" || -L "$release_dir/backend/.env" ]]; then
  rm -f "$release_dir/backend/.env"
fi
ln -s "$PROJECT_DIR/backend/.env" "$release_dir/backend/.env"

log "Installing dependencies for ${target_commit:0:12}."
runuser -u "$DEPLOY_USER" -- /bin/bash -lc \
  'source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd "$1" && npm ci' \
  _ "$release_dir"

systemctl stop "mgps-erp-slot@$candidate_slot.service"
tmp_link="${slot_link}.new"
rm -f "$tmp_link"
ln -s "$release_dir" "$tmp_link"
mv -Tf "$tmp_link" "$slot_link"

log "Starting candidate slot $candidate_slot on port $candidate_port."
systemctl start "mgps-erp-slot@$candidate_slot.service"

healthy=false
for _ in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$candidate_port/api/health" |
    grep -q '"database":"connected"'; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  systemctl stop "mgps-erp-slot@$candidate_slot.service" || true
  log "Candidate failed its database health check; the active slot remains unchanged."
  exit 1
fi

systemctl enable "mgps-erp-slot@$candidate_slot.service" >/dev/null

old_upstream="$(cat "$CADDY_UPSTREAM")"
upstream_tmp="${CADDY_UPSTREAM}.new"
printf 'reverse_proxy 127.0.0.1:%s\n' "$candidate_port" >"$upstream_tmp"
chown root:root "$upstream_tmp"
chmod 0644 "$upstream_tmp"
mv -f "$upstream_tmp" "$CADDY_UPSTREAM"

if ! caddy validate --config "$CADDY_FILE" --adapter caddyfile ||
  ! systemctl reload caddy; then
  printf '%s\n' "$old_upstream" >"$upstream_tmp"
  chown root:root "$upstream_tmp"
  chmod 0644 "$upstream_tmp"
  mv -f "$upstream_tmp" "$CADDY_UPSTREAM"
  systemctl reload caddy || true
  systemctl stop "mgps-erp-slot@$candidate_slot.service" || true
  systemctl disable "mgps-erp-slot@$candidate_slot.service" >/dev/null 2>&1 || true
  log "Caddy switch failed; restored the previous upstream."
  exit 1
fi

if ! curl --fail --silent http://127.0.0.1:8080/api/health |
  grep -q '"database":"connected"'; then
  printf '%s\n' "$old_upstream" >"$upstream_tmp"
  chown root:root "$upstream_tmp"
  chmod 0644 "$upstream_tmp"
  mv -f "$upstream_tmp" "$CADDY_UPSTREAM"
  systemctl reload caddy
  systemctl stop "mgps-erp-slot@$candidate_slot.service" || true
  systemctl disable "mgps-erp-slot@$candidate_slot.service" >/dev/null 2>&1 || true
  log "Post-switch health check failed; restored the previous upstream."
  exit 1
fi

printf '%s\n' "$candidate_slot" >"${ACTIVE_SLOT_FILE}.new"
mv -f "${ACTIVE_SLOT_FILE}.new" "$ACTIVE_SLOT_FILE"
printf '%s\n' "$target_commit" >"${ACTIVE_COMMIT_FILE}.new"
mv -f "${ACTIVE_COMMIT_FILE}.new" "$ACTIVE_COMMIT_FILE"
printf '%s\n' "$target_commit" >"$STATE_DIR/deployed-commit.new"
mv -f "$STATE_DIR/deployed-commit.new" "$STATE_DIR/deployed-commit"

log "Traffic switched to ${target_commit:0:12}; allowing existing requests to drain."
sleep 15
systemctl stop "mgps-erp-slot@$active_slot.service" || \
  log "Previous slot could not be stopped; it is no longer receiving new traffic."
systemctl disable "mgps-erp-slot@$active_slot.service" >/dev/null 2>&1 || true
systemctl disable mgps-erp.service >/dev/null 2>&1 || true
log "Deployment completed successfully."
