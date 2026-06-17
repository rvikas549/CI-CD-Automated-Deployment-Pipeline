#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-monitoring.sh — Run this on your EC2 instance to launch the full
# monitoring stack (Prometheus + Grafana + Node Exporter + cAdvisor)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()     { echo -e "${BLUE}[setup]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }

EC2_IP=$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 || echo "YOUR_EC2_IP")

# ── Step 1: Install Docker Compose ───────────────────────────────────────────
log "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
success "Docker Compose installed"

# ── Step 2: Create directory structure ───────────────────────────────────────
log "Creating monitoring directory structure..."
mkdir -p ~/monitoring/{prometheus,grafana/{provisioning/{datasources,dashboards},dashboards}}
success "Directories created"

# ── Step 3: Copy config files ─────────────────────────────────────────────────
log "Writing config files..."

# prometheus.yml
cat > ~/monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "ai-tools-api"
    static_configs:
      - targets: ["ai-tools-api:3000"]
    metrics_path: /metrics

  - job_name: "node-exporter"
    static_configs:
      - targets: ["node-exporter:9100"]

  - job_name: "cadvisor"
    static_configs:
      - targets: ["cadvisor:8080"]
EOF

# Grafana datasource
cat > ~/monitoring/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Grafana dashboard provisioning
cat > ~/monitoring/grafana/provisioning/dashboards/dashboard.yml << 'EOF'
apiVersion: 1
providers:
  - name: "AI Tools API"
    orgId: 1
    folder: ""
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
EOF

success "Config files written"

# ── Step 4: Stop old standalone container if running ─────────────────────────
log "Stopping old standalone ai-tools-api container if running..."
docker stop ai-tools-api 2>/dev/null || true
docker rm   ai-tools-api 2>/dev/null || true

# ── Step 5: Start the full monitoring stack ───────────────────────────────────
log "Starting monitoring stack with Docker Compose..."
cd ~/monitoring
docker-compose up -d

# ── Step 6: Wait and health check ─────────────────────────────────────────────
log "Waiting 15s for all services to start..."
sleep 15

echo ""
success "=== Monitoring Stack is UP ==="
echo ""
echo -e "${GREEN}📊 Grafana:${NC}        http://${EC2_IP}:3001  (admin / admin)"
echo -e "${GREEN}📈 Prometheus:${NC}     http://${EC2_IP}:9090"
echo -e "${GREEN}🟢 App:${NC}            http://${EC2_IP}:3000/api/tools"
echo -e "${GREEN}📉 App Metrics:${NC}    http://${EC2_IP}:3000/metrics"
echo -e "${GREEN}🖥️  Node Exporter:${NC} http://${EC2_IP}:9100/metrics"
echo ""
warn "Next step: Open Grafana at http://${EC2_IP}:3001 and import dashboard ID 1860"
