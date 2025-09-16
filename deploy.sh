#!/bin/bash
set -e  # Exit on any error

# Required environment variables
: "${BASE_DIR:?Need to set BASE_DIR}"
: "${REPO_NAME:?Need to set REPO_NAME}"
: "${REPO_URL:?Need to set REPO_URL}"
: "${BRANCH:?Need to set BRANCH}"
: "${TAG:=latest}"
: "${CONTAINER_NAME:?Need to set CONTAINER_NAME}"

cd "$BASE_DIR" || exit 1

# ----- Remove old code (except persistent data) -----
echo "Cleaning up existing code..."
rm -rf "$REPO_NAME"

# ----- Clone latest code -----
echo "Cloning repository $REPO_URL (branch: $BRANCH)..."
git clone -b "$BRANCH" "$REPO_URL" "$REPO_NAME"

cd "$BASE_DIR/$REPO_NAME"

# ----- Show recent commits -----
git log -n 3 --oneline

# ----- Copy Dockerfile and .env -----
cp "$BASE_DIR/Dockerfile" .
cp "$BASE_DIR/.env" .

# ----- Build Docker image with tag -----
echo "Building Docker image $REPO_NAME:$TAG..."
docker build -t "$REPO_NAME:$TAG" .

# ----- Stop existing container -----
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
  echo "Stopping existing container $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME"
fi

# ----- Remove old image if exists (optional) -----
docker rmi "$REPO_NAME:latest" 2>/dev/null || true

# ----- Start service with docker-compose -----
cd "$BASE_DIR"
echo "Starting $CONTAINER_NAME service with docker-compose..."
docker compose up -d --build --force-recreate

# ----- Wait and show logs -----
sleep 15
echo "Logs from $CONTAINER_NAME ($TAG):"
docker logs "$CONTAINER_NAME"
