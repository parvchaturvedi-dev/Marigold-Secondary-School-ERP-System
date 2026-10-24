#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
SERVICE_NAME="mgps-erp"

if ! grep -qi "Ubuntu" /etc/os-release; then
  echo "This setup script supports Ubuntu on WSL only." >&2
  exit 1
fi

if [[ "$EUID" -eq 0 ]]; then
  echo "Run this script as your normal Ubuntu user, not with sudo." >&2
  exit 1
fi

if [[ -e "$BACKEND_DIR/.env" ]]; then
  echo "Refusing to overwrite $BACKEND_DIR/.env." >&2
  echo "Back up/remove that file yourself before running setup again." >&2
  exit 1
fi

echo "Installing PostgreSQL and required tools..."
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git postgresql postgresql-contrib

if ! command -v systemctl >/dev/null 2>&1 || [[ "$(ps -p 1 -o comm= | tr -d ' ')" != "systemd" ]]; then
  echo "systemd is not running in WSL. Enable it in /etc/wsl.conf, then run 'wsl --shutdown' in PowerShell and retry."
  echo "Required /etc/wsl.conf content:"
  printf '[boot]\nsystemd=true\n'
  exit 1
fi

echo "Starting PostgreSQL..."
sudo systemctl enable --now postgresql

if ! command -v nvm >/dev/null 2>&1 && [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
  echo "Installing Node Version Manager..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "Could not find nvm after installation." >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22
nvm use 22

echo "Preparing an empty local ERP database..."
PG_PASSWORD="$(openssl rand -hex 32)"
DATABASE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'mgps_erp'")"
if [[ "$DATABASE_EXISTS" == "1" ]]; then
  TABLE_COUNT="$(sudo -u postgres psql -d mgps_erp -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  if [[ "$TABLE_COUNT" != "0" ]]; then
    echo "Database mgps_erp already has public tables; refusing to initialize or modify it." >&2
    echo "Choose a new empty database manually before retrying." >&2
    exit 1
  fi
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'mgps_erp'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE mgps_erp LOGIN"
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE mgps_erp WITH LOGIN PASSWORD '$PG_PASSWORD'"

if [[ "$DATABASE_EXISTS" != "1" ]]; then
  sudo -u postgres createdb --owner=mgps_erp mgps_erp
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER DATABASE mgps_erp OWNER TO mgps_erp"
fi

sudo -u postgres psql -d mgps_erp -v ON_ERROR_STOP=1 \
  -c "GRANT ALL ON SCHEMA public TO mgps_erp"

echo
read -r -s -p "Set a temporary initial admin password (minimum 12 characters): " ADMIN_PASSWORD
echo
if (( ${#ADMIN_PASSWORD} < 12 )); then
  echo "Admin password must be at least 12 characters." >&2
  exit 1
fi

read -r -s -p "Cloudinary URL (optional; leave blank to configure later): " CLOUDINARY_URL
echo

JWT_SECRET="$(openssl rand -hex 32)"
SESSION_SECRET="$(openssl rand -hex 32)"
DATABASE_URL="postgresql://mgps_erp:${PG_PASSWORD}@127.0.0.1:5432/mgps_erp"
export DATABASE_URL ADMIN_PASSWORD CLOUDINARY_URL JWT_SECRET SESSION_SECRET
export PROJECT_BACKEND_DIR="$BACKEND_DIR"

python3 - <<'PY'
import os
from pathlib import Path

backend_dir = Path(os.environ["PROJECT_BACKEND_DIR"])
env_path = backend_dir / ".env"
entries = {
    "PORT": "5000",
    "DATABASE_URL": os.environ["DATABASE_URL"],
    "NODE_ENV": "production",
    "JWT_SECRET": os.environ["JWT_SECRET"],
    "SESSION_SECRET": os.environ["SESSION_SECRET"],
    "CLIENT_ORIGIN": "http://127.0.0.1:5173",
    "CORS_ORIGINS": "https://www.mghub.marigoldschoolbehror.com,https://mghub.marigoldschoolbehror.com,http://localhost:5173",
    "FRONTEND_URL": "https://www.mghub.marigoldschoolbehror.com",
    "AUTH_AUTO_PROVISION": "true",
    "AUTH_AUTO_PROVISION_PASSWORD": os.environ["ADMIN_PASSWORD"],
}
if os.environ.get("CLOUDINARY_URL"):
    entries["CLOUDINARY_URL"] = os.environ["CLOUDINARY_URL"]

with env_path.open("x", encoding="utf-8", newline="\n") as env_file:
    for key, value in entries.items():
        env_file.write(f"{key}={value}\n")
env_path.chmod(0o600)
PY

unset PG_PASSWORD ADMIN_PASSWORD CLOUDINARY_URL JWT_SECRET SESSION_SECRET DATABASE_URL

echo "Installing ERP dependencies..."
cd "$PROJECT_DIR"
npm ci

echo "Creating and verifying the empty ERP schema..."
npm --prefix backend run db:initialize-empty-postgres

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$UNIT_FILE" >/dev/null <<EOF
[Unit]
Description=MGPS ERP backend
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=/bin/bash -lc 'source "$NVM_DIR/nvm.sh" && exec npm --prefix backend run start'
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo "Waiting for the backend health endpoint..."
for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:5000/api/health | grep -q '"database":"connected"'; then
    echo "Backend is responding at http://127.0.0.1:5000/api/health"
    echo "Admin login: ADM-001 (use the temporary password you entered)."
    echo "After the first successful login, set AUTH_AUTO_PROVISION=false in backend/.env and restart:"
    echo "  sudo systemctl restart $SERVICE_NAME"
    echo "Service logs: sudo journalctl -u $SERVICE_NAME -f"
    echo "Database is new and empty; Neon records were not copied."
    exit 0
  fi
  sleep 2
done

echo "Backend did not become healthy. Recent logs:" >&2
sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager >&2
exit 1
