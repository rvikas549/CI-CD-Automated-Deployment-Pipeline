
# CI/CD Automated Deployment Pipeline

A production-grade Node.js REST API that returns a curated list of AI tools. The project demonstrates end-to-end DevOps practices — containerization with Docker, automated testing, CI/CD with GitHub Actions, and zero-downtime deployment to AWS EC2 with email notifications.

![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?logo=github-actions)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-20--alpine-339933?logo=node.js)
![AWS EC2](https://img.shields.io/badge/AWS-EC2-FF9900?logo=amazon-aws)
![License](https://img.shields.io/badge/License-MIT-green)


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
- [Environment Variables](#environment-variables)
- [GitHub Secrets](#github-secrets)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Shell Scripts](#shell-scripts)

---

## Project Overview

This project was built to demonstrate a complete CI/CD pipeline for a real-world Node.js application. Every time code is merged into the `main` branch:

1. Tests run automatically to catch any breaking changes
2. A Docker image is built and pushed to Docker Hub
3. The new image is pulled and deployed to AWS EC2 via SSH
4. An HTML email is sent confirming success or failure

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
  Docker Hub                   AWS EC2
  (Image Registry)             (Amazon Linux 2023)
                                    │
                                    ▼
                             Container running
                             on port 3000
                                    │
                                    ▼
                          http://EC2_IP:3000/api/tools
                          (Live on the internet)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 (Alpine) |
| Framework | Express.js |
| Testing | Jest + Supertest |
| Containerization | Docker (multi-stage build) |
| Registry | Docker Hub |
| CI/CD | GitHub Actions |
| Cloud | AWS EC2 (Amazon Linux 2023) |
| Notifications | Gmail SMTP (dawidd6/action-send-mail) |
| Shell Scripting | Bash (deploy + local helper scripts) |

---

## Project Structure

```
CI-CD-Automated-Deployment-Pipeline/
├── src/
│   ├── app.js              # Express routes and AI tools data
│   └── server.js           # HTTP server + graceful shutdown (SIGTERM/SIGINT)
│
├── tests/
│   └── app.test.js         # Jest + Supertest test suite (8 tests)
│
├── scripts/
│   ├── docker-local.sh     # Local Docker helper (build/run/stop/logs/health/clean)
│   └── deploy.sh           # Production deploy script (called on EC2 via SSH)
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # Full 4-job CI/CD pipeline
│
├── Dockerfile              # Multi-stage: deps → test → production
├── .dockerignore           # Keeps production image lean
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

```yaml
- name: Run tests with coverage
  run: npm run test:coverage
```

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

**Why it matters:** The Docker image is the deployable artifact. Every successful push to `main` produces a new versioned image. The `sha-` tag gives you a permanent reference to any version.

```dockerfile
# Multi-stage: only production code ends up in the final image
FROM node:20-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

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

```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.DEPLOY_HOST }}
    username: ec2-user
    key: ${{ secrets.DEPLOY_SSH_KEY }}
```

---

### Job 4: Email Notification

**Runs on:** Always (even if Job 3 fails)
**Depends on:** Jobs 2 and 3 (reads their results)

**What it does:**
- Checks whether the deploy succeeded or failed
- Sends an HTML email via Gmail SMTP containing:
  - ✅ or ❌ status
  - Repository name
  - Branch name
  - Commit SHA
  - Commit message
  - Author
  - Docker image tag
  - Link to the full Actions run

**Why it matters:** In production, you must know when something breaks — even at 3am. The email always fires so you're never in the dark about a deploy.

---

## Docker Setup

### Dockerfile — Multi-Stage Build

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
- [x] Test coverage uploaded as CI artifact
- [x] Docker layer caching via GitHub Actions cache
- [x] Image versioned by git commit SHA
- [x] Email notification on every deploy (pass or fail)
- [x] Dangling image cleanup after every deploy
- [x] `--restart unless-stopped` keeps container alive after EC2 reboots

---

## License

MIT


## How Everything Connects — Explained Simply
The Big Picture
You write code on your Mac → push to GitHub → everything else happens automatically.
What Each Part Does
GitHub Actions is the brain. It watches your repo and runs 4 jobs in sequence every time you push to main.
Job 1 — Test is the quality gate. It installs your Node.js dependencies and runs all 8 Jest tests. If even one test fails, the entire pipeline stops here. Nothing broken ever moves forward.
Job 2 — Build & Push packages your app into a Docker image using a 3-stage Dockerfile. Stage 1 installs production deps, Stage 2 runs tests inside Docker as a second check, Stage 3 creates the final lean image with a non-root user and no dev tools. That image gets pushed to Docker Hub tagged as both latest and sha-<commit-hash> so you can always roll back to any version.
Job 3 — Deploy SSHes into your EC2 instance, pulls the new image from Docker Hub, stops the old container, starts the new one, and then curls /health to confirm the app is actually alive. If the health check fails, the job fails and you know immediately.
Job 4 — Email always runs regardless of whether the deploy passed or failed. It sends you an HTML email with the full status, commit message, author, and a link to the Actions run.
Docker Hub is just a storage registry — like GitHub but for Docker images. No ports, no running code. It just holds your images so EC2 can pull them.
EC2 is where your app actually runs. It's an Amazon Linux 2023 server running one Docker container on port 3000, accessible at http://YOUR_EC2_IP:3000/api/tools.

##Thank You 🩷
