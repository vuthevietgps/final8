#!/usr/bin/env bash

set -Eeuo pipefail

SSH_USER="${SSH_USER:-admin-001}"
SSH_HOST="${SSH_HOST:-htxbachgia.shop}"
SSH_PORT="${SSH_PORT:-22}"
TARGET="${SSH_USER}@${SSH_HOST}"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  cat <<EOF
Usage:
  $0                    # Open interactive SSH session
  $0 "<command>"        # Run one remote command

Defaults:
  target=${TARGET}
  port=${SSH_PORT}

Override with environment variables:
  SSH_USER, SSH_HOST, SSH_PORT
EOF
  exit 0
fi

if [ "$#" -eq 0 ]; then
  exec ssh -t -p "${SSH_PORT}" "${TARGET}"
fi

exec ssh -t -p "${SSH_PORT}" "${TARGET}" "$@"
