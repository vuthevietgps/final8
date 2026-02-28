#!/bin/bash

# Build and push Docker images to Docker Hub
# Usage: ./build-and-push.sh [version]
# Example: ./build-and-push.sh version17

set -e

VERSION="${1:-version17}"
REPO="vutheviet/final8new"

echo "=========================================="
echo "  Build & Push: ${REPO}"
echo "  Tag: ${VERSION}"
echo "=========================================="

# 1. Build backend
echo ""
echo "[1/4] Building backend..."
docker build -t ${REPO}:backend-${VERSION} ./backend

# 2. Build frontend
echo ""
echo "[2/4] Building frontend..."
docker build -t ${REPO}:frontend-${VERSION} ./frontend

# 3. Push backend
echo ""
echo "[3/4] Pushing backend..."
docker push ${REPO}:backend-${VERSION}

# 4. Push frontend
echo ""
echo "[4/4] Pushing frontend..."
docker push ${REPO}:frontend-${VERSION}

echo ""
echo "=========================================="
echo "  DONE!"
echo "  Backend:  ${REPO}:backend-${VERSION}"
echo "  Frontend: ${REPO}:frontend-${VERSION}"
echo "=========================================="
