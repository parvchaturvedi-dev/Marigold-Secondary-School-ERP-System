#!/usr/bin/env bash
set -Eeuo pipefail

STATE_DIR="/var/lib/mgps-erp-auto-update"
STATE_FILE="$STATE_DIR/deployed-commit"

log() {
  printf '[mgps-erp-auto-update] %s\n' "$*"
}

if [[ "${EUID}" -ne 0 ]]; then
  log "Updater must run as root."
  exit 1
fi

exec 9>/run/lock/mgps-erp-deploy.lock
if ! flock -n 9; then
  log "Another deployment operation is in progress; skipping this timer run."
  exit 0
fi

app_git() {
  runuser -u "$DEPLOY_USER" -- git -C "$PROJECT_DIR" "$@"
}

if [[ -z "${PROJECT_DIR:-}" || -z "${DEPLOY_USER:-}" ]]; then
  log "PROJECT_DIR and DEPLOY_USER must be configured."
  exit 1
fi

if [[ "$(app_git rev-parse --show-toplevel)" != "$PROJECT_DIR" ]]; then
  log "Configured project directory is not a Git repository."
  exit 1
fi

branch="$(app_git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  log "Skipping update because the laptop checkout is on '$branch', not main."
  exit 0
fi

if [[ -n "$(app_git status --porcelain --untracked-files=normal)" ]]; then
  log "Skipping update because the laptop checkout has local changes. Commit, stash, or remove them first."
  exit 0
fi

app_git fetch --quiet origin main
current_commit="$(app_git rev-parse HEAD)"
remote_commit="$(app_git rev-parse origin/main)"

if [[ "$current_commit" != "$remote_commit" ]]; then
  if app_git merge-base --is-ancestor HEAD origin/main; then
    app_git merge --ff-only --quiet origin/main
    current_commit="$(app_git rev-parse HEAD)"
    log "Fast-forwarded laptop checkout to ${current_commit:0:12}."
  elif app_git merge-base --is-ancestor origin/main HEAD; then
    log "Skipping deployment because the laptop checkout has unpublished commits."
    exit 0
  else
    log "Skipping deployment because local main and origin/main have diverged."
    exit 1
  fi
fi

if ! cmp -s "$PROJECT_DIR/scripts/auto-update-wsl.sh" /usr/local/sbin/mgps-erp-auto-update.sh; then
  install -o root -g root -m 0755 \
    "$PROJECT_DIR/scripts/auto-update-wsl.sh" \
    /usr/local/sbin/mgps-erp-auto-update.sh
  exec /usr/local/sbin/mgps-erp-auto-update.sh
fi

deployed_commit="$(cat "$STATE_FILE")"
if [[ "$deployed_commit" == "$current_commit" ]]; then
  exit 0
fi

if ! app_git cat-file -e "${deployed_commit}^{commit}" 2>/dev/null ||
  ! app_git merge-base --is-ancestor "$deployed_commit" "$current_commit"; then
  log "Cannot safely compare the last deployed commit with the current checkout."
  exit 1
fi

if [[ -f "$STATE_DIR/blue-green-enabled" ]]; then
  log "Using blue-green deployment for ${current_commit:0:12}."
  exec /bin/bash "$PROJECT_DIR/scripts/deploy-blue-green-wsl.sh" "$current_commit"
fi

changed_manifests="$(app_git diff --name-only "$deployed_commit" "$current_commit" -- \
  package.json package-lock.json backend/package.json frontend/package.json)"
if [[ -n "$changed_manifests" ]]; then
  log "Dependency manifests changed; running npm ci before restart."
  runuser -u "$DEPLOY_USER" -- /bin/bash -lc \
    'source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd "$1" && npm ci' \
    _ "$PROJECT_DIR"
fi

log "Restarting the ERP backend."
systemctl restart mgps-erp

for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:5000/api/health |
    grep -q '"database":"connected"'; then
    printf '%s\n' "$current_commit" >"${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"
    log "Backend is healthy at ${current_commit:0:12}."
    exit 0
  fi
  sleep 2
done

log "Backend did not become healthy. Check: journalctl -u mgps-erp -n 50"
exit 1
