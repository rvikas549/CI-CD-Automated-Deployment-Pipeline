#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# docker-local.sh  — Build, test, run, and manage the app container locally
#
# Usage:
#   ./scripts/docker-local.sh build     Build the production image
#   ./scripts/docker-local.sh run       Run the container (builds if needed)
#   ./scripts/docker-local.sh stop      Stop and remove the container
#   ./scripts/docker-local.sh logs      Tail container logs
#   ./scripts/docker-local.sh health    Hit /health and pretty-print JSON
#   ./scripts/docker-local.sh clean     Remove container + image
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

IMAGE="ai-tools-api:local"
CONTAINER="ai-tools-api-local"
PORT=3000

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()     { echo -e "${BLUE}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── Helpers ───────────────────────────────────────────────────────────────────
require_docker() {
  command -v docker &>/dev/null || error "Docker is not installed or not in PATH"
}

container_running() {
  docker ps --filter "name=${CONTAINER}" --format "{{.Names}}" | grep -q "^${CONTAINER}$"
}

# ── Commands ──────────────────────────────────────────────────────────────────
cmd_build() {
  require_docker
  log "Building Docker image: ${IMAGE}"
  docker build --target production -t "${IMAGE}" .
  success "Image built → ${IMAGE}"
}

cmd_run() {
  require_docker

  # Build first if image does not exist
  if ! docker image inspect "${IMAGE}" &>/dev/null; then
    warn "Image not found — building first"
    cmd_build
  fi

  # Stop any previous run
  if container_running; then
    warn "Stopping existing container"
    docker stop "${CONTAINER}" &>/dev/null
    docker rm   "${CONTAINER}" &>/dev/null
  fi

  log "Starting container → http://localhost:${PORT}"
  docker run -d \
    --name "${CONTAINER}" \
    --restart unless-stopped \
    -p "${PORT}:${PORT}" \
    -e NODE_ENV=production \
    "${IMAGE}"

  sleep 2
  cmd_health
}

cmd_stop() {
  require_docker
  if container_running; then
    docker stop "${CONTAINER}" && docker rm "${CONTAINER}"
    success "Container stopped and removed"
  else
    warn "Container '${CONTAINER}' is not running"
  fi
}

cmd_logs() {
  require_docker
  docker logs -f "${CONTAINER}"
}

cmd_health() {
  require_docker
  log "Checking health at http://localhost:${PORT}/health"
  # Retry up to 5 times (container might still be starting)
  for i in {1..5}; do
    if curl -sf "http://localhost:${PORT}/health" | python3 -m json.tool 2>/dev/null; then
      success "Health check passed"
      return
    fi
    warn "Attempt $i failed — retrying in 2 s…"
    sleep 2
  done
  error "Health check failed after 5 attempts"
}

cmd_clean() {
  require_docker
  warn "Removing container and image '${IMAGE}'"
  docker stop "${CONTAINER}" 2>/dev/null || true
  docker rm   "${CONTAINER}" 2>/dev/null || true
  docker rmi  "${IMAGE}"     2>/dev/null || true
  success "Cleaned up"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "${1:-help}" in
  build)   cmd_build  ;;
  run)     cmd_run    ;;
  stop)    cmd_stop   ;;
  logs)    cmd_logs   ;;
  health)  cmd_health ;;
  clean)   cmd_clean  ;;
  *)
    echo "Usage: $0 {build|run|stop|logs|health|clean}"
    exit 1
    ;;
esac
