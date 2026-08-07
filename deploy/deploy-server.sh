#!/bin/bash
# Deploy only the server container cleanly (avoids port 3001 conflicts)
set -e

cd /root/teammail

echo "==> Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "==> Stopping old server container..."
docker compose stop server || true
docker compose rm -f server || true

# Extra safety: kill any process still holding port 3001
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

echo "==> Building and starting server..."
docker compose up --build -d server

echo "==> Waiting for server health check..."
sleep 3
STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health 2>/dev/null || echo "000")
if [ "$STATUS" = "200" ]; then
  echo "✅ Server is up and healthy (HTTP $STATUS)"
else
  echo "⚠️  Server returned HTTP $STATUS - check logs:"
  docker compose logs server --tail=30
  exit 1
fi
