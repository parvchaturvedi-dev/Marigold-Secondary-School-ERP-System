#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_USER="$(id -un)"
UNIT_NAME="mgps-erp-auto-update"

if [[ "$EUID" -eq 0 ]]; then
  echo "Run this installer as your normal Ubuntu user, not with sudo." >&2
  exit 1
fi

if [[ "$(ps -p 1 -o comm= | tr -d ' ')" != "systemd" ]]; then
  echo "systemd is not running in WSL. Start WSL with systemd enabled and retry." >&2
  exit 1
fi

if [[ "$(git -C "$PROJECT_DIR" branch --show-current)" != "main" ]]; then
  echo "The laptop repository must be checked out on main." >&2
  exit 1
fi

if [[ -n "$(git -C "$PROJECT_DIR" status --porcelain --untracked-files=normal)" ]]; then
  echo "The laptop repository has local changes. Commit, stash, or remove them before setup." >&2
  exit 1
fi

origin_url="$(git -C "$PROJECT_DIR" remote get-url origin)"
origin_url="${origin_url%.git}"
case "$origin_url" in
  https://github.com/parvchaturvedi-dev/Marigold-Secondary-School-ERP-System|\
  git@github.com:parvchaturvedi-dev/Marigold-Secondary-School-ERP-System|\
  ssh://git@github.com/parvchaturvedi-dev/Marigold-Secondary-School-ERP-System)
    ;;
  *)
    echo "The origin remote is not the expected MGPS ERP GitHub repository." >&2
    exit 1
    ;;
esac

if [[ "$PROJECT_DIR" =~ [[:space:]] ]]; then
  echo "The repository path must not contain spaces for this systemd setup." >&2
  exit 1
fi

if ! systemctl cat mgps-erp.service >/dev/null 2>&1; then
  echo "The mgps-erp.service backend is not installed." >&2
  exit 1
fi

DEPLOYED_COMMIT="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
sudo install -o root -g root -m 0755 \
  "$PROJECT_DIR/scripts/auto-update-wsl.sh" \
  "/usr/local/sbin/${UNIT_NAME}.sh"
sudo install -d -o root -g root -m 0755 "/var/lib/${UNIT_NAME}"
if ! sudo test -e "/var/lib/${UNIT_NAME}/deployed-commit"; then
  printf '%s\n' "$DEPLOYED_COMMIT" |
    sudo tee "/var/lib/${UNIT_NAME}/deployed-commit" >/dev/null
fi

sudo tee "/etc/default/${UNIT_NAME}" >/dev/null <<EOF
PROJECT_DIR=$PROJECT_DIR
DEPLOY_USER=$DEPLOY_USER
EOF

sudo tee "/etc/systemd/system/${UNIT_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Fetch and deploy MGPS ERP changes from GitHub main
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/default/${UNIT_NAME}
ExecStart=/usr/local/sbin/${UNIT_NAME}.sh
EOF

sudo tee "/etc/systemd/system/${UNIT_NAME}.timer" >/dev/null <<EOF
[Unit]
Description=Check GitHub for MGPS ERP updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Persistent=true
Unit=${UNIT_NAME}.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl start mgps-erp
for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:5000/api/health |
    grep -q '"database":"connected"'; then
    break
  fi
  sleep 2
done
if ! curl --fail --silent http://127.0.0.1:5000/api/health |
  grep -q '"database":"connected"'; then
  echo "The backend did not become healthy; automatic updates were not enabled." >&2
  sudo journalctl -u mgps-erp -n 50 --no-pager >&2
  exit 1
fi

sudo systemctl enable --now "${UNIT_NAME}.timer"

echo "Automatic laptop updates are enabled."
echo "The timer checks GitHub main every two minutes while this WSL distro is running."
echo "Check status: sudo systemctl status ${UNIT_NAME}.timer --no-pager"
echo "Check logs:   sudo journalctl -u ${UNIT_NAME}.service -n 50 --no-pager"
