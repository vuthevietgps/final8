#!/bin/bash

# Build and push Docker images to Docker Hub.
# Usage: ./build-and-push.sh [version]
# Example: ./build-and-push.sh version20

set -Eeuo pipefail

VERSION="${1:-version20}"
REPO="${REPO:-vutheviet/final8new}"
PUSH_LATEST="${PUSH_LATEST:-1}"

BACKEND_VERSION_TAG="${REPO}:backend-${VERSION}"
FRONTEND_VERSION_TAG="${REPO}:frontend-${VERSION}"
BACKEND_LATEST_TAG="${REPO}:backend-latest"
FRONTEND_LATEST_TAG="${REPO}:frontend-latest"

echo "=========================================="
echo "  Build & Push: ${REPO}"
echo "  Version tag : ${VERSION}"
echo "  Push latest : ${PUSH_LATEST}"
echo "=========================================="

echo ""
echo "[1/6] Building backend image..."
docker build \
  -f backend/Dockerfile \
  -t "${BACKEND_VERSION_TAG}" \
  .

if [ "${PUSH_LATEST}" = "1" ]; then
  docker tag "${BACKEND_VERSION_TAG}" "${BACKEND_LATEST_TAG}"
fi

echo ""
echo "[2/6] Building frontend image..."
docker build \
  -f frontend/Dockerfile \
  -t "${FRONTEND_VERSION_TAG}" \
  ./frontend

if [ "${PUSH_LATEST}" = "1" ]; then
  docker tag "${FRONTEND_VERSION_TAG}" "${FRONTEND_LATEST_TAG}"
fi

echo ""
echo "[3/6] Pushing backend version tag..."
docker push "${BACKEND_VERSION_TAG}"

echo ""
echo "[4/6] Pushing frontend version tag..."
docker push "${FRONTEND_VERSION_TAG}"

if [ "${PUSH_LATEST}" = "1" ]; then
  echo ""
  echo "[5/6] Pushing backend latest tag..."
  docker push "${BACKEND_LATEST_TAG}"

  echo ""
  echo "[6/6] Pushing frontend latest tag..."
  docker push "${FRONTEND_LATEST_TAG}"
else
  echo ""
  echo "[5/6] Skipping backend latest tag"
  echo "[6/6] Skipping frontend latest tag"
fi

echo ""
echo "=========================================="
echo "  DONE!"
echo "  Backend version: ${BACKEND_VERSION_TAG}"
echo "  Frontend version: ${FRONTEND_VERSION_TAG}"
if [ "${PUSH_LATEST}" = "1" ]; then
  echo "  Backend latest : ${BACKEND_LATEST_TAG}"
  echo "  Frontend latest: ${FRONTEND_LATEST_TAG}"
fi
echo "=========================================="
