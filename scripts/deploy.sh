#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  — Production deploy script executed on the remote server via SSH
#
# Called by the GitHub Actions "Deploy via SSH" step.
# Can also be run manually on the server:
#   ./scripts/deploy.sh <docker-image> [port]
#
# Example:
#   ./scripts/deploy.sh yourdockerhubuser/ai-tools-api:latest 3000
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

IMAGE="${1:-ai-tools-api:latest}"
PORT="${2:-3000}"
CONTAINER="ai-tools-api"
MAX_WAIT=30   # seconds to wait for health check

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()     { echo -e "${BLUE}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC}     $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}   $*"; }
error()   { echo -e "${RED}[error]${NC}  $*" >&2; exit 1; }

# ── Checks ────────────────────────────────────────────────────────────────────
command -v docker &>/dev/null || error "Docker is not installed"
command -v curl   &>/dev/null || error "curl is required for health check"

log "Starting deploy"
log "Image     : ${IMAGE}"
log "Container : ${CONTAINER}"
log "Port      : ${PORT}"

# ── Pull image ────────────────────────────────────────────────────────────────
log "Pulling image from registry…"
docker pull "${IMAGE}"

# ── Stop old container ────────────────────────────────────────────────────────
if docker ps -q --filter "name=${CONTAINER}" | grep -q .; then
  warn "Stopping running container '${CONTAINER}'"
  docker stop "${CONTAINER}"
fi
if docker ps -aq --filter "name=${CONTAINER}" | grep -q .; then
  warn "Removing container '${CONTAINER}'"
  docker rm "${CONTAINER}"
fi

# ── Start new container ───────────────────────────────────────────────────────
log "Starting new container…"
docker run -d \
  --name "${CONTAINER}" \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -e NODE_ENV=production \
  "${IMAGE}"

# ── Health check with retry ───────────────────────────────────────────────────
log "Waiting for service to become healthy (max ${MAX_WAIT}s)…"
ELAPSED=0
until curl -sf "http://localhost:${PORT}/health" > /dev/null; do
  if (( ELAPSED >= MAX_WAIT )); then
    docker logs "${CONTAINER}" --tail 30
    error "Service did not become healthy within ${MAX_WAIT}s"
  fi
  sleep 2
  (( ELAPSED += 2 ))
done
success "Service healthy after ${ELAPSED}s"

# ── Cleanup dangling images ───────────────────────────────────────────────────
log "Pruning dangling images…"
docker image prune -f

success "Deploy complete ✓"
