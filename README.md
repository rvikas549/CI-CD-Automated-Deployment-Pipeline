# CI/CD Automated Deployment Pipeline

![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?logo=github-actions)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-20--alpine-339933?logo=node.js)
![AWS EC2](https://img.shields.io/badge/AWS-EC2-FF9900?logo=amazon-aws)
![Grafana](https://img.shields.io/badge/Monitoring-Grafana-F46800?logo=grafana)
![Prometheus](https://img.shields.io/badge/Metrics-Prometheus-E6522C?logo=prometheus)
![License](https://img.shields.io/badge/License-MIT-green)

A production-grade Node.js REST API serving a curated list of AI tools — containerized with Docker, automated end-to-end with GitHub Actions, deployed to AWS EC2, and monitored live with a full Prometheus + Grafana observability stack featuring Node Exporter and cAdvisor.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [CI/CD Pipeline](#cicd-pipeline)
  - [Job 1: Lint & Test](#job-1-lint--test)
  - [Job 2: Build & Push Docker Image](#job-2-build--push-docker-image)
  - [Job 3: Deploy to Production](#job-3-deploy-to-production)
  - [Job 4: Email Notification](#job-4-email-notification)
- [Docker Setup](#docker-setup)
- [Monitoring Stack](#monitoring-stack)
  - [What is Node Exporter?](#what-is-node-exporter)
  - [What is cAdvisor?](#what-is-cadvisor)
  - [How Prometheus Scrapes](#how-prometheus-scrapes)
  - [Grafana Dashboards](#grafana-dashboards)
- [Environment Variables](#environment-variables)
- [GitHub Secrets](#github-secrets)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Shell Scripts](#shell-scripts)
- [Production Checklist](#production-checklist)

---

## Project Overview

This project was built to demonstrate a complete, production-grade DevOps pipeline:

1. **Tests run automatically** to catch breaking changes (Jest + Supertest)
2. **Docker image is built** using a 3-stage multi-stage Dockerfile and pushed to Docker Hub
3. **Automatic deployment** to AWS EC2 via SSH with a health check
4. **Email notification** confirms success or failure
5. **Live monitoring** via Prometheus + Grafana + Node Exporter + cAdvisor

Every time you `git push origin main`, the entire pipeline executes hands-free in ~5 minutes.

---

## Architecture

```
Developer (git push main)
        │
        ▼
   GitHub Repo
        │
        ▼ triggers
┌─────────────────────────────────────────────────┐
│              GitHub Actions                     │
│                                                 │
│  Job 1: Lint & Test                             │
│    └── npm ci + jest --coverage                 │
│              │                                  │
│  Job 2: Build & Push (only on main)             │
│    └── docker build (multi-stage)               │
│    └── docker push → Docker Hub                 │
│              │                                  │
│  Job 3: Deploy to Production (only on main)     │
│    └── SSH into EC2                             │
│    └── docker pull latest image                 │
│    └── stop old → start new container           │
│    └── curl /health (verify it's running)       │
│              │                                  │
│  Job 4: Email Notification (always runs)        │
│    └── Gmail SMTP → HTML email (pass/fail)      │
└─────────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
  Docker Hub                   AWS EC2 (Amazon Linux 2023)
  (Image Registry)             ┌──────────────────────────────┐
                                │ Docker Compose Stack:        │
                                │                              │
                                │ 1. ai-tools-api  :3000       │
                                │    (main app, exposes        │
                                │     /metrics)                │
                                │                              │
                                │ 2. prometheus    :9090       │
                                │    (scrapes metrics from     │
                                │     app, node-exporter,      │
                                │     cadvisor)                │
                                │                              │
                                │ 3. grafana       :3001       │
                                │    (visualizes metrics)      │
                                │                              │
                                │ 4. node-exporter :9100       │
                                │    (EC2 server health:       │
                                │     CPU, RAM, disk, network) │
                                │                              │
                                │ 5. cadvisor      :8080       │
                                │    (per-container metrics:   │
                                │     CPU, RAM, I/O per app)   │
                                └──────────────────────────────┘
                                        │
                                        ▼
                              Browser → Grafana Dashboards
                              http://EC2_IP:3001
                              (live monitoring)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 (Alpine) |
| Framework | Express.js |
| Testing | Jest + Supertest |
| Containerization | Docker (multi-stage build) + Docker Compose |
| Registry | Docker Hub |
| CI/CD | GitHub Actions (4-job pipeline) |
| Cloud | AWS EC2 (Amazon Linux 2023) |
| **Metrics Collection** | **Prometheus** |
| **System Metrics** | **Node Exporter** |
| **Container Metrics** | **cAdvisor** |
| **Visualization** | **Grafana** |
| Notifications | Gmail SMTP (dawidd6/action-send-mail) |
| Shell Scripting | Bash (deploy + local helper scripts) |

---

## Project Structure

```
CI-CD-Automated-Deployment-Pipeline/
├── src/
│   ├── app.js              # Express routes, AI tools data, /metrics endpoint
│   └── server.js           # HTTP server + graceful shutdown
│
├── tests/
│   └── app.test.js         # Jest + Supertest test suite (8 tests)
│
├── scripts/
│   ├── docker-local.sh     # Local Docker helper (build/run/stop/logs/health/clean)
│   └── deploy.sh           # Production deploy script (called on EC2 via SSH)
│
├── monitoring/
│   ├── docker-compose.yml  # Prometheus + Grafana + Node Exporter + cAdvisor + app
│   ├── setup-monitoring.sh # One-time EC2 monitoring setup
│   ├── prometheus/
│   │   └── prometheus.yml  # Scrape config (tells Prometheus what to monitor)
│   └── grafana/
│       └── provisioning/
│           ├── datasources/prometheus.yml   # Auto-connects Grafana to Prometheus
│           └── dashboards/dashboard.yml     # Auto-loads dashboards
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # Full 4-job GitHub Actions pipeline
│
├── Dockerfile              # Multi-stage: deps → test → production
├── .dockerignore
├── .gitignore
└── package.json
```

---

## API Endpoints

Base URL (local): `http://localhost:3000`
Base URL (production): `http://YOUR_EC2_IP:3000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API metadata and available endpoints |
| GET | `/health` | Health check — uptime, timestamp, version |
| GET | `/metrics` | Prometheus metrics (scraped every 15 seconds) |
| GET | `/api/tools` | Returns all 8 AI tools |
| GET | `/api/tools?category=LLM / Assistant` | Filter tools by category |
| GET | `/api/tools/:id` | Get a single tool by ID |
| GET | `/api/categories` | Get all unique categories |

### Sample Response — `GET /api/tools`

```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": 1,
      "name": "Claude",
      "company": "Anthropic",
      "category": "LLM / Assistant",
      "description": "AI assistant for analysis, writing, and coding",
      "url": "https://claude.ai"
    }
  ]
}
```

### Sample Response — `GET /health`

```json
{
  "status": "ok",
  "uptime": 3600.5,
  "timestamp": "2026-06-08T00:00:00.000Z",
  "version": "1.0.0"
}
```

---

## CI/CD Pipeline

The pipeline is defined in `.github/workflows/ci-cd.yml` and has 4 jobs.

### Job 1: Lint & Test

**Runs on:** Every push and every pull request to `main`

**What it does:**
- Checks out the code
- Sets up Node.js 20 with npm cache
- Runs `npm ci` to install all dependencies cleanly
- Runs `npm run test:coverage` — all 8 Jest tests must pass
- Uploads the coverage report as a downloadable artifact (kept 7 days)

**Why it matters:** This is the first gate. If any test fails, the pipeline stops here. No broken code ever reaches Docker Hub or production.

---

### Job 2: Build & Push Docker Image

**Runs on:** Push to `main` only (not on PRs)
**Depends on:** Job 1 (tests must pass)

**What it does:**
- Sets up Docker Buildx for multi-platform builds
- Logs into Docker Hub using secrets
- Builds the multi-stage Docker image:
  - **Stage 1 (deps):** Installs only production dependencies
  - **Stage 2 (test):** Runs Jest inside the Docker build to double-verify
  - **Stage 3 (production):** Lean final image, non-root user, no devDeps
- Tags the image with:
  - `yourusername/ai-tools-api:latest`
  - `yourusername/ai-tools-api:sha-<short-commit-hash>`
- Pushes both tags to Docker Hub
- Uses GitHub Actions layer cache to speed up subsequent builds

**Why it matters:** The Docker image is the deployable artifact. Every successful push to `main` produces a new versioned image.

---

### Job 3: Deploy to Production

**Runs on:** Push to `main` only
**Depends on:** Job 2 (image must be pushed successfully)

**What it does:**
1. Uses `appleboy/ssh-action` to SSH into your EC2 instance
2. On the EC2 instance, runs these commands:
   - `docker pull rvikas549/ai-tools-api:latest` — gets the newest image
   - `docker stop ai-tools-api` — gracefully stops the old container
   - `docker rm ai-tools-api` — removes the old container
   - `docker run -d ...` — starts the new container with `--restart unless-stopped`
   - `docker image prune -f` — cleans up old dangling images to save disk space
   - `curl -sf http://localhost:3000/health` — verifies the app is actually responding
3. If the health check fails, the job fails and you get a failure email

**Why it matters:** This is zero-touch deployment. You push code, the server updates itself. The health check ensures a bad deploy is caught immediately.

---

### Job 4: Email Notification

**Runs on:** Always (even if Job 3 fails)
**Depends on:** Jobs 2 and 3 (reads their results)

**What it does:**
- Checks whether the deploy succeeded or failed
- Sends an HTML email via Gmail SMTP containing:
  - ✅ or ❌ status badge
  - Repository name
  - Branch name
  - Commit SHA
  - Commit message
  - Author name
  - Docker image tag
  - Link to the full Actions run

**Why it matters:** In production, you must know when something breaks — even at 3am. The email always fires so you're never in the dark about a deploy.

---

## Docker Setup

### Dockerfile — 3-Stage Multi-Stage Build

```
Stage 1 (deps)       →  npm ci --only=production
Stage 2 (test)       →  npm ci + npm test (fail fast if tests break)
Stage 3 (production) →  copy deps from Stage 1 + source code only
                        non-root user (appuser)
                        no devDependencies
                        no test files
```

The final production image is lean and secure — it contains only what's needed to run the app.

### Local Docker Commands

```bash
# Make the script executable (one-time)
chmod +x scripts/docker-local.sh

# Build the image
./scripts/docker-local.sh build

# Run the container
./scripts/docker-local.sh run

# Check app health
./scripts/docker-local.sh health

# Tail logs
./scripts/docker-local.sh logs

# Stop the container
./scripts/docker-local.sh stop

# Remove container + image
./scripts/docker-local.sh clean
```

### Manual Docker Commands

```bash
# Build
docker build -t ai-tools-api:local .

# Run
docker run -d \
  --name ai-tools-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  ai-tools-api:local

# Check logs
docker logs -f ai-tools-api

# Health check
curl http://localhost:3000/health
```

---

## Monitoring Stack

The `monitoring/` directory runs a full observability stack via Docker Compose alongside the app on EC2. This gives you **real-time visibility** into your infrastructure and application.

### Components

| Service | Port | Purpose |
|---------|------|---------|
| `ai-tools-api` | 3000 | Your Node.js app; exposes `/metrics` for Prometheus |
| `prometheus` | 9090 | Time-series database; scrapes and stores metrics every 15 seconds |
| `grafana` | 3001 | Dashboard UI; queries Prometheus for visualization |
| `node-exporter` | 9100 | Exposes EC2 **server-level** metrics (CPU, RAM, disk, network) |
| `cadvisor` | 8080 | Exposes **per-container** resource metrics (CPU, RAM, I/O) |

---

### What is Node Exporter?

**Node Exporter** is a monitoring agent that collects **system-level metrics** from your EC2 instance.

#### What does it measure?

- **CPU:** Current usage, load average, context switches
- **Memory:** Used, free, buffered, cached RAM
- **Disk:** Space used, free, I/O operations
- **Network:** Bytes in/out, packets, errors on each interface
- **File system:** Inodes, mount points, space
- **Processes:** Running, sleeping, zombie processes

#### How does it work?

1. Node Exporter reads from Linux `/proc` and `/sys` files (the same data `top` or `df` commands use)
2. Exposes all this data as Prometheus-formatted metrics on port 9090
3. Prometheus scrapes this endpoint every 15 seconds
4. You see live graphs in Grafana

#### Example metrics Node Exporter exposes:

```
node_cpu_seconds_total{cpu="0",mode="user"} 12345.67
node_memory_MemFree_bytes 8589934592
node_filesystem_avail_bytes{device="/dev/xvda1",fstype="ext4",mountpoint="/"} 53687091200
node_network_receive_bytes_total{device="eth0"} 134234567
```

#### Why you need it:

Without Node Exporter, you have **no visibility** into whether your EC2 instance is:
- Running out of disk space (catastrophic — deployments fail silently)
- CPU-bound (app is slow)
- Memory-swapping (terrible performance)
- Network bottlenecked

With Grafana + Node Exporter, you get **live alerts** when any of this happens.

---

### What is cAdvisor?

**cAdvisor** (Container Advisor) is a monitoring agent that collects **per-container metrics**.

#### What does it measure?

- **CPU:** CPU time, throttling, shares
- **Memory:** Current usage, limits, page faults, OOM kills
- **Network:** Bytes sent/received per container
- **Disk I/O:** Read/write bytes and operations
- **Filesystem:** Usage per container

#### How does it work?

1. cAdvisor talks to the Docker daemon via `/var/run/docker.sock`
2. Asks: "What containers are running? What are their stats?"
3. Collects real-time resource usage from each container
4. Exposes metrics on port 8080
5. Prometheus scrapes this endpoint every 15 seconds
6. You see per-container dashboards in Grafana

#### Example metrics cAdvisor exposes:

```
container_cpu_usage_seconds_total{name="ai-tools-api"} 345.67
container_memory_usage_bytes{name="ai-tools-api"} 67108864
container_network_receive_bytes_total{name="ai-tools-api"} 234567890
```

#### Why you need it:

Without cAdvisor, you have **no idea**:
- How much CPU/RAM your Node.js app is actually using
- If it's leaking memory over time
- If the Prometheus container is consuming more resources than your app
- Which container is the resource hog when multiple run

With cAdvisor + Grafana, you can see **exactly** which container is misbehaving and by how much.

---

### How Prometheus Scrapes

**Prometheus** is the central metrics database. It acts as a "data collector."

1. **Prometheus reads its config** (`prometheus.yml`):
   ```yaml
   scrape_configs:
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
   ```

2. **Every 15 seconds, Prometheus:**
   - Hits `http://ai-tools-api:3000/metrics` (your app)
   - Hits `http://node-exporter:9100/metrics` (system stats)
   - Hits `http://cadvisor:8080/metrics` (container stats)
   - Stores all the data in its time-series database

3. **Grafana queries Prometheus** and draws graphs:
   - "Show me CPU usage over the last hour"
   - "Show me memory usage for the ai-tools-api container"
   - "Show me request rate (requests per second)"

---

### Grafana Dashboards

**Grafana** is the visualization layer.

#### Recommended Dashboards to Import

| Dashboard ID | What it shows |
|---------------|----------------|
| `1860` | **Node Exporter Full** — EC2 server health (CPU, RAM, disk, network) |
| `893` | **Docker Container Metrics** — per-container resource usage via cAdvisor |
| **Custom** | **AI Tools API** — custom metrics (request rate, p95 latency) using `prom-client` |

#### Custom App Metrics (from prom-client)

The app exposes two custom metrics:

- `http_requests_total` — Counter of HTTP requests by method, route, status
- `http_request_duration_seconds` — Histogram of response times (p50, p95, p99)

#### Example Grafana Queries

```promql
# Request rate (requests per second)
rate(http_requests_total[5m])

# 95th percentile response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status_code="500"}[5m])

# CPU usage
rate(node_cpu_seconds_total{mode="user"}[5m])
```

#### Access URLs

| URL | Purpose |
|-----|---------|
| `http://YOUR_EC2_IP:3001` | Grafana dashboard (login: admin/admin) |
| `http://YOUR_EC2_IP:9090` | Prometheus query UI (raw PromQL queries) |
| `http://YOUR_EC2_IP:3000/metrics` | Your app's metrics endpoint (what Prometheus scrapes) |
| `http://YOUR_EC2_IP:9100/metrics` | Node Exporter's metrics endpoint |
| `http://YOUR_EC2_IP:8080/metrics` | cAdvisor's metrics endpoint |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the Express server listens on |
| `NODE_ENV` | `development` | Set to `production` in container |

---

## GitHub Secrets

Configure these in: **GitHub Repo → Settings → Secrets and variables → Actions**

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (Account → Security → Access Tokens) |
| `DEPLOY_HOST` | EC2 public IP address (e.g. `16.171.21.209`) |
| `DEPLOY_SSH_KEY` | Full contents of your `.pem` file (from `-----BEGIN` to `-----END`) |
| `MAIL_USERNAME` | Gmail address for sending notifications |
| `MAIL_PASSWORD` | Gmail App Password — 16-char (Google Account → Security → App Passwords) |
| `MAIL_TO` | Email address to receive notifications |

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/rvikas549/CI-CD-Automated-Deployment-Pipeline.git
cd CI-CD-Automated-Deployment-Pipeline

# 2. Install dependencies
npm install

# 3. Start dev server (hot reload)
npm run dev
# Server running at http://localhost:3000

# 4. Run tests
npm test

# 5. Run tests with coverage
npm run test:coverage
```

> Note: Stop any running Docker containers before running `npm run dev`
> to avoid port 3000 conflicts.

---

## Production Deployment

### EC2 Setup (one-time)

```bash
# SSH into your EC2 instance
ssh -i ~/Downloads/linux-kp.pem ec2-user@YOUR_EC2_IP

# Install Docker on Amazon Linux 2023
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
newgrp docker

# Verify
docker --version
```

### Trigger a Deployment

Simply push to main:

```bash
git add .
git commit -m "feat: your change here"
git push origin main
```

GitHub Actions takes over from here:
- Tests run in ~30 seconds
- Image builds and pushes in ~2 minutes
- EC2 gets the new container in ~3 minutes
- Email arrives confirming success or failure

### Manual Deployment (emergency)

```bash
ssh -i ~/Downloads/linux-kp.pem ec2-user@YOUR_EC2_IP

docker pull rvikas549/ai-tools-api:latest
docker stop ai-tools-api && docker rm ai-tools-api
docker run -d \
  --name ai-tools-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  rvikas549/ai-tools-api:latest

curl http://localhost:3000/health
```

---

## Shell Scripts

### `scripts/docker-local.sh`

A local helper script for managing the Docker container on your dev machine.

```
Usage: ./scripts/docker-local.sh {build|run|stop|logs|health|clean}
```

| Command | Action |
|---------|--------|
| `build` | Build the Docker image locally |
| `run` | Build (if needed) and start the container |
| `stop` | Stop and remove the container |
| `logs` | Tail the container logs |
| `health` | Hit `/health` and pretty-print the JSON response |
| `clean` | Remove both the container and the image |

### `scripts/deploy.sh`

The production deploy script executed on the EC2 server via SSH. Also runnable manually:

```bash
./scripts/deploy.sh rvikas549/ai-tools-api:latest 3000
```

Features:
- Pulls the latest image from Docker Hub
- Gracefully stops and removes the old container
- Starts the new container with `--restart unless-stopped`
- Health check with retry loop (up to 30 seconds)
- Prunes dangling images automatically
- Coloured output for easy log reading

---

## Production Checklist

- [x] Non-root Docker user (`appuser`) for security
- [x] Multi-stage build — no devDependencies in production image
- [x] `.dockerignore` keeps image size minimal
- [x] Graceful SIGTERM/SIGINT shutdown in `server.js`
- [x] `/health` endpoint for container health monitoring
- [x] `/metrics` endpoint for Prometheus scraping
- [x] Test coverage uploaded as CI artifact
- [x] Docker layer caching via GitHub Actions cache
- [x] Image versioned by git commit SHA
- [x] Email notification on every deploy (pass or fail)
- [x] Dangling image cleanup after every deploy
- [x] `--restart unless-stopped` keeps container alive after EC2 reboots
- [x] Live observability via Prometheus + Grafana
- [x] Custom application metrics (request rate, p95 latency)
- [x] Node Exporter for EC2 system metrics
- [x] cAdvisor for per-container resource monitoring

---

## How Everything Connects — Explained Simply

### The Big Picture

You write code on your Mac → push to GitHub → everything else happens automatically.

### What Each Part Does

**GitHub Actions** is the brain. It watches your repo and runs 4 jobs in sequence every time you push to `main`.

**Job 1 — Test** is the quality gate. It installs your Node.js dependencies and runs all 8 Jest tests. If even one test fails, the entire pipeline stops here. Nothing broken ever moves forward.

**Job 2 — Build & Push** packages your app into a Docker image using a 3-stage Dockerfile. Stage 1 installs production deps, Stage 2 runs tests inside Docker as a second check, Stage 3 creates the final lean image with a non-root user and no dev tools. That image gets pushed to Docker Hub tagged as both `latest` and `sha-<commit-hash>` so you can always roll back to any version.

**Job 3 — Deploy** SSHes into your EC2 instance, pulls the new image from Docker Hub, stops the old container, starts the new one, and then curls `/health` to confirm the app is actually alive. If the health check fails, the job fails and you know immediately.

**Job 4 — Email** always runs regardless of whether the deploy passed or failed. It sends you an HTML email with the full status, commit message, author, and a link to the Actions run.

**Docker Hub** is just a storage registry — like GitHub but for Docker images. No ports, no running code. It just holds your images so EC2 can pull them.

**EC2** is where your app actually runs. It's an Amazon Linux 2023 server running a Docker Compose stack with 5 containers:
- Your Node.js app on port 3000
- Prometheus on port 9090 (collecting metrics)
- Grafana on port 3001 (visualizing them)
- Node Exporter on port 9100 (EC2 system stats)
- cAdvisor on port 8080 (container stats)

**Node Exporter** tells you about your **server** — is it running out of disk? Is CPU maxed out? Is RAM swapping?

**cAdvisor** tells you about your **containers** — is the app container using too much memory? Is Prometheus growing unbounded?

**Prometheus** collects data from all three (your app, Node Exporter, cAdvisor) every 15 seconds.

**Grafana** draws live graphs from Prometheus data so you can see everything at a glance.

---

## License

MIT

---

## Thank You 🩷

Built with passion and best practices for production DevOps in 2026.
