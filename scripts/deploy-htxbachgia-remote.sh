#!/usr/bin/env bash

set -Eeuo pipefail

TAG="${1:-latest}"
SSH_USER="${SSH_USER:-admin-001}"
SSH_HOST="${SSH_HOST:-192.168.100.237}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_BATCH_MODE="${SSH_BATCH_MODE:-no}"
REMOTE_DIR="${REMOTE_DIR:-/opt/websites/sites/htxbachgia-shop}"
LOCAL_SCRIPT="${LOCAL_SCRIPT:-deploy-htxbachgia.sh}"
REMOTE_SCRIPT="${REMOTE_SCRIPT:-deploy-htxbachgia.sh}"
COPY_SCRIPT="${COPY_SCRIPT:-1}"
REMOTE_USE_SUDO="${REMOTE_USE_SUDO:-1}"
TARGET="${SSH_USER}@${SSH_HOST}"
SSH_OPTS=(
  "-p" "${SSH_PORT}"
  "-o" "StrictHostKeyChecking=${SSH_STRICT_HOST_KEY_CHECKING}"
)
if [ -n "${SSH_KEY_PATH}" ]; then
  SSH_OPTS+=("-i" "${SSH_KEY_PATH}")
fi
if [ "${SSH_BATCH_MODE}" = "yes" ]; then
  SSH_OPTS+=("-o" "BatchMode=yes")
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  cat <<EOF
Usage:
  $0 [tag]

Defaults:
  tag=latest
  target=${TARGET}
  port=${SSH_PORT}
  remote_dir=${REMOTE_DIR}

Environment overrides:
  SSH_USER, SSH_HOST, SSH_PORT
  SSH_KEY_PATH
  SSH_STRICT_HOST_KEY_CHECKING
  SSH_BATCH_MODE=yes
  REMOTE_DIR
  LOCAL_SCRIPT, REMOTE_SCRIPT
  REMOTE_USE_SUDO=0  # default 1, set 0 if remote user can run deploy without sudo
  COPY_SCRIPT=0  # skip scp step
EOF
  exit 0
fi

if [ "${COPY_SCRIPT}" = "1" ]; then
  if [ ! -f "${LOCAL_SCRIPT}" ]; then
    echo "ERROR: local script not found: ${LOCAL_SCRIPT}" >&2
    exit 1
  fi

  echo "[1/2] Copying ${LOCAL_SCRIPT} -> ${TARGET}:${REMOTE_DIR}/${REMOTE_SCRIPT}"
  scp "${SSH_OPTS[@]}" "${LOCAL_SCRIPT}" "${TARGET}:${REMOTE_DIR}/${REMOTE_SCRIPT}"
fi

echo "[2/2] Running remote deploy on ${TARGET}"
if [ "${REMOTE_USE_SUDO}" = "1" ]; then
  REMOTE_RUN_CMD="cd '${REMOTE_DIR}' && chmod +x '${REMOTE_SCRIPT}' && sudo './${REMOTE_SCRIPT}' '${TAG}'"
else
  REMOTE_RUN_CMD="cd '${REMOTE_DIR}' && chmod +x '${REMOTE_SCRIPT}' && './${REMOTE_SCRIPT}' '${TAG}'"
fi
ssh -t "${SSH_OPTS[@]}" "${TARGET}" "${REMOTE_RUN_CMD}"
