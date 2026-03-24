#!/bin/bash
# Deploy script for VPS 213.155.21.111
# Usage: bash deploy.sh

set -e

echo "=== Kaspi Seller Pro — Deploy ==="

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if needed
if ! command -v docker compose &> /dev/null; then
    echo "Installing Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# Generate secret key if not exists
if [ ! -f .env ]; then
    echo "SECRET_KEY=$(openssl rand -hex 32)" > .env
    echo ".env created with random SECRET_KEY"
fi

echo "Building and starting services..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo ""
echo "=== Done! ==="
echo "Site: http://213.155.21.111"
echo "API docs: http://213.155.21.111/api/docs"
echo ""
docker compose ps
