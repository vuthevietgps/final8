#!/usr/bin/env bash

set -Eeuo pipefail

TAG="${1:-latest}"
SSH_USER="${SSH_USER:-admin-001}"
SSH_HOST="${SSH_HOST:-192.168.100.237}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/websites/sites/htxbachgia-shop}"
LOCAL_SCRIPT="${LOCAL_SCRIPT:-deploy-htxbachgia.sh}"
REMOTE_SCRIPT="${REMOTE_SCRIPT:-deploy-htxbachgia.sh}"
COPY_SCRIPT="${COPY_SCRIPT:-1}"
TARGET="${SSH_USER}@${SSH_HOST}"

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
  REMOTE_DIR
  LOCAL_SCRIPT, REMOTE_SCRIPT
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
  scp -P "${SSH_PORT}" "${LOCAL_SCRIPT}" "${TARGET}:${REMOTE_DIR}/${REMOTE_SCRIPT}"
fi

echo "[2/2] Running remote deploy on ${TARGET}"
ssh -t -p "${SSH_PORT}" "${TARGET}" \
  "cd '${REMOTE_DIR}' && chmod +x '${REMOTE_SCRIPT}' && sudo './${REMOTE_SCRIPT}' '${TAG}'"