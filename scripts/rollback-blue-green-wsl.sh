#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="/var/lib/mgps-erp"
CADDY_UPSTREAM="/etc/caddy/mgps-active-upstream"
ACTIVE_SLOT_FILE="$DEPLOY_DIR/active-slot"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this rollback script as root." >&2
  exit 1
fi

exec 9>/run/lock/mgps-erp-deploy.lock
if ! flock -n 9; then
  echo "Another deployment operation is in progress; refusing rollback." >&2
  exit 1
fi

if [[ ! -f "$ACTIVE_SLOT_FILE" || ! -f "$CADDY_UPSTREAM" ]]; then
  echo "Blue-green deployment is not initialized." >&2
  exit 1
fi

current_upstream="$(cat "$CADDY_UPSTREAM")"
case "$current_upstream" in
  "reverse_proxy 127.0.0.1:5001") active_slot=blue; previous_slot=green; previous_port=5002 ;;
  "reverse_proxy 127.0.0.1:5002") active_slot=green; previous_slot=blue; previous_port=5001 ;;
  *)
    echo "Caddy upstream does not point to a recognized backend slot." >&2
    exit 1
    ;;
esac

if [[ ! -L "$DEPLOY_DIR/slots/$previous_slot" ]]; then
  echo "No previous release is available to roll back to." >&2
  exit 1
fi

systemctl start "mgps-erp-slot@$previous_slot.service"
healthy=false
for _ in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$previous_port/api/health" |
    grep -q '"database":"connected"'; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  systemctl stop "mgps-erp-slot@$previous_slot.service" || true
  echo "Previous release failed its health check; active traffic was not changed." >&2
  exit 1
fi

old_upstream="$(cat "$CADDY_UPSTREAM")"
tmp="${CADDY_UPSTREAM}.new"
printf 'reverse_proxy 127.0.0.1:%s\n' "$previous_port" >"$tmp"
chown root:root "$tmp"
chmod 0644 "$tmp"
mv -f "$tmp" "$CADDY_UPSTREAM"

if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile ||
  ! systemctl reload caddy ||
  ! curl --fail --silent http://127.0.0.1:8080/api/health |
    grep -q '"database":"connected"'; then
  printf '%s\n' "$old_upstream" >"$tmp"
  chown root:root "$tmp"
  chmod 0644 "$tmp"
  mv -f "$tmp" "$CADDY_UPSTREAM"
  systemctl reload caddy || true
  echo "Rollback switch failed; restored the current upstream." >&2
  exit 1
fi

printf '%s\n' "$previous_slot" >"${ACTIVE_SLOT_FILE}.new"
mv -f "${ACTIVE_SLOT_FILE}.new" "$ACTIVE_SLOT_FILE"
systemctl enable "mgps-erp-slot@$previous_slot.service" >/dev/null
printf '%s\n' "$(basename "$(readlink -f "$DEPLOY_DIR/slots/$previous_slot")")" \
  >"$DEPLOY_DIR/active-commit"
systemctl disable "mgps-erp-slot@$active_slot.service" >/dev/null 2>&1 || true
echo "Traffic rolled back to the previous healthy slot."
