#!/usr/bin/env bash

set -Eeuo pipefail

TAG="${1:-version16}"
REPO="${REPO:-vutheviet/final8new}"
PORT="${PORT:-8090}"

SSH_USER="${SSH_USER:-admin-001}"
SSH_HOST="${SSH_HOST:-192.168.100.237}"
SSH_PORT="${SSH_PORT:-22}"
TARGET="${SSH_USER}@${SSH_HOST}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_BATCH_MODE="${SSH_BATCH_MODE:-no}"
SSH_OPTS=(
  "-4"
  "-o" "ConnectTimeout=10"
  "-o" "StrictHostKeyChecking=${SSH_STRICT_HOST_KEY_CHECKING}"
  "-p" "${SSH_PORT}"
)
if [ -n "${SSH_KEY_PATH}" ]; then
  SSH_OPTS+=("-i" "${SSH_KEY_PATH}")
fi
if [ "${SSH_BATCH_MODE}" = "yes" ]; then
  SSH_OPTS+=("-o" "BatchMode=yes")
fi

REMOTE_DIR="${REMOTE_DIR:-/opt/websites/sites/htxbachgia-shop}"
REMOTE_COMPOSE="${REMOTE_COMPOSE:-docker-compose.yml}"
REMOTE_OVERRIDE="${REMOTE_OVERRIDE:-/tmp/htxbachgia-override.yml}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-htxbachgia-shop-backend}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-htxbachgia-shop-frontend}"

BACKEND_IMAGE="${REPO}:backend-${TAG}"
FRONTEND_IMAGE="${REPO}:frontend-${TAG}"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  cat <<EOF
Usage:
  $0 [tag]

Environment overrides:
  REPO, PORT
  SSH_USER, SSH_HOST, SSH_PORT
  SSH_KEY_PATH
  SSH_STRICT_HOST_KEY_CHECKING
  SSH_BATCH_MODE=yes   # disable password prompt, fail fast if key auth fails
  REMOTE_DIR, REMOTE_COMPOSE, REMOTE_OVERRIDE
EOF
  exit 0
fi

for cmd in docker ssh; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "ERROR: missing required command: ${cmd}" >&2
    exit 1
  fi
done

read_remote_health() {
  local container="$1"
  local value
  value="$(ssh "${SSH_OPTS[@]}" "${TARGET}" "docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' '${container}' 2>/dev/null" 2>/dev/null || true)"
  if [ -z "${value}" ]; then
    echo "missing"
  else
    echo "${value}"
  fi
}

read_remote_http() {
  local url="$1"
  local value
  value="$(ssh "${SSH_OPTS[@]}" "${TARGET}" "curl -s -o /dev/null -w '%{http_code}' '${url}' 2>/dev/null" 2>/dev/null || true)"
  if [ -z "${value}" ]; then
    echo "000"
  else
    echo "${value}"
  fi
}

echo "=========================================="
echo "Deploy target : ${TARGET}"
echo "Version tag   : ${TAG}"
echo "Repo          : ${REPO}"
echo "Remote dir    : ${REMOTE_DIR}"
echo "Compose file  : ${REMOTE_COMPOSE}"
echo "Override file : ${REMOTE_OVERRIDE}"
if [ -n "${SSH_KEY_PATH}" ]; then
  echo "SSH key       : ${SSH_KEY_PATH}"
fi
echo "SSH batch     : ${SSH_BATCH_MODE}"
echo "=========================================="

echo "[1/6] Verify Docker Hub tags exist..."
docker manifest inspect "${BACKEND_IMAGE}" >/dev/null
docker manifest inspect "${FRONTEND_IMAGE}" >/dev/null

echo "[2/6] Verify SSH + remote compose..."
ssh "${SSH_OPTS[@]}" "${TARGET}" "cd '${REMOTE_DIR}' && if command -v docker compose >/dev/null 2>&1; then docker compose version >/dev/null 2>&1 || true; fi; docker-compose version >/dev/null"

echo "[3/6] Pull target images on remote..."
ssh "${SSH_OPTS[@]}" "${TARGET}" "docker pull '${BACKEND_IMAGE}' && docker pull '${FRONTEND_IMAGE}'"

echo "[4/6] Write override and restart stack..."
ssh "${SSH_OPTS[@]}" "${TARGET}" "cat > '${REMOTE_OVERRIDE}' <<'EOF'
services:
  backend:
    image: ${BACKEND_IMAGE}
    healthcheck:
      test: [\"CMD\", \"wget\", \"--no-verbose\", \"--tries=1\", \"--spider\", \"http://127.0.0.1:3000/health\"]
  frontend:
    image: ${FRONTEND_IMAGE}
    healthcheck:
      test: [\"CMD\", \"wget\", \"--no-verbose\", \"--tries=1\", \"--spider\", \"http://127.0.0.1/\"]
EOF
cd '${REMOTE_DIR}' && docker-compose -f '${REMOTE_COMPOSE}' -f '${REMOTE_OVERRIDE}' up -d --remove-orphans"

echo "[5/6] Verify remote health..."
BACKEND_HEALTH="starting"
FRONTEND_HEALTH="starting"
for _ in $(seq 1 24); do
  BACKEND_HEALTH="$(read_remote_health "${BACKEND_CONTAINER}")"
  FRONTEND_HEALTH="$(read_remote_health "${FRONTEND_CONTAINER}")"
  if [ "${BACKEND_HEALTH}" = "healthy" ] && [ "${FRONTEND_HEALTH}" = "healthy" ]; then
    break
  fi
  sleep 5
done

FRONTEND_HTTP="$(read_remote_http "http://127.0.0.1:${PORT}")"

echo "[6/6] Done"
echo ""
echo "=========================================="
echo "Backend image   : ${BACKEND_IMAGE}"
echo "Frontend image  : ${FRONTEND_IMAGE}"
echo "Backend health  : ${BACKEND_HEALTH:-unknown}"
echo "Frontend health : ${FRONTEND_HEALTH:-unknown}"
echo "Frontend HTTP   : ${FRONTEND_HTTP:-000}"
echo "Logs command:"
if [ -n "${SSH_KEY_PATH}" ]; then
  echo "  ssh -4 -p ${SSH_PORT} -i '${SSH_KEY_PATH}' ${TARGET} \"cd '${REMOTE_DIR}' && docker-compose -f '${REMOTE_COMPOSE}' -f '${REMOTE_OVERRIDE}' logs -f\""
else
  echo "  ssh -4 -p ${SSH_PORT} ${TARGET} \"cd '${REMOTE_DIR}' && docker-compose -f '${REMOTE_COMPOSE}' -f '${REMOTE_OVERRIDE}' logs -f\""
fi
echo "=========================================="
