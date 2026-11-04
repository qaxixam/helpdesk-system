#!/usr/bin/env bash
set -euo pipefail
cd /opt/medops
REGION="$1"; REGISTRY="$2"; TAG="$3"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

[ -f .current_tag ] && cp .current_tag .previous_tag
export IMAGE="$REGISTRY/medops-helpdesk:$TAG"
docker compose pull app
docker compose up -d --remove-orphans

for i in $(seq 1 24); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "$TAG" > .current_tag
    docker image prune -f
    echo "Deployed $TAG"
    exit 0
  fi
  sleep 5
done

echo "Health check failed, rolling back"
if [ -f .previous_tag ]; then
  export IMAGE="$REGISTRY/medops-helpdesk:$(cat .previous_tag)"
  docker compose up -d
fi
exit 1