# CivicTwin AI — Production Deployment Guide

## 1. System Overview & Architecture

CivicTwin AI is an institutional-grade Digital Public Infrastructure (DPI) platform designed for state planning commissions, municipal municipal corporations (ULBs), and public-sector analysts.

```
+-------------------------------------------------------------------------------+
|                                INGRESS LAYER                                  |
|   Reverse Proxy / Ingress Controller (Nginx / Caddy / Cloud Load Balancer)    |
|   SSL Termination (TLS 1.3), Gzip / Brotli, Request ID Propagation            |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                            CIVICTWIN AI RUNTIME                               |
|   Node.js 20+ Express API (Port 3001) + Static SPA Bundle (/dist/client)      |
|                                                                               |
|   Security & Defense:                                                         |
|     * Helmet Security Headers                                                 |
|     * DPI Rate Limiter (Token-Bucket: 300 req/min/IP)                          |
|     * Verbatim Native Script Preservation                                     |
|     * Correlation ID (`X-Request-Id`) Logging                                 |
|                                                                               |
|   Domain Services:                                                            |
|     * Citizen Multilingual & Voice Intake (en, hi, bn, ta, te, mr)            |
|     * Infrastructure Risk Radar (Geographic Spatial Clustering)               |
|     * Civic Evidence Graph (Atomic Tracing & Evidence IDs)                   |
|     * Explainable Priority Engine (Deterministic Math, No LLM Arithmetic)     |
|     * Gemini Evidence Brief Synthesizer (Structured Grounding)                |
|     * Tamper-Evident SHA-256 Audit Trail                                      |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                              PERSISTENCE LAYER                                |
|   Prisma ORM Client -> SQLite (Zero-Config / Testing) or PostgreSQL           |
+-------------------------------------------------------------------------------+
```

---

## 2. Environment Variables Reference

| Variable Name | Required | Default Value | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | No | `production` | Environment mode (`development`, `test`, `production`). |
| `PORT` | No | `3001` | TCP port for the backend Express server. |
| `DATABASE_URL` | **Yes** | `file:./dev.db` | Prisma database connection string (SQLite file path or PostgreSQL URL). |
| `GEMINI_API_KEY` | Optional | `""` | Google AI Studio API key. When omitted, deterministic fallback NLP is active. |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model variant used for structured entity extraction and evidence briefs. |
| `SESSION_SECRET` | **Yes** | — | Cryptographic salt for cookie sessions and token signing. |
| `ALLOWED_ORIGINS`| No | `http://localhost:3000,http://localhost:3001` | Comma-separated list of allowed CORS origins. |

---

## 3. Database Migration & Seeding Procedures

### 3.1 Initial Database Setup
```bash
# Generate Prisma Client
npm run prisma:generate

# Push database schema without losing existing demonstration data
npx prisma db push

# Run deterministic public-sector seed data (6 Indic languages, 3 states, 6 hotspots)
npm run prisma:seed
```

### 3.2 Production Migrations
For production database deployments using PostgreSQL:
```bash
# Run pending schema migrations
npx prisma migrate deploy
```

---

## 4. Containerized Deployment (Docker)

### 4.1 Build Docker Image
```bash
docker build -t civictwin-ai:latest -f Dockerfile .
```

### 4.2 Run Standalone Container
```bash
docker run -d \
  --name civictwin-ai \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e GEMINI_API_KEY="YOUR_GEMINI_API_KEY" \
  -v civictwin_data:/app/prisma \
  civictwin-ai:latest
```

### 4.3 Run via Docker Compose
```bash
docker compose up -d
```

---

## 5. Kubernetes Orchestration

Deploy using the tested manifests in `k8s/deployment.yaml`:

```bash
# 1. Create secrets
kubectl create secret generic civictwin-secrets \
  --from-literal=database-url="file:/app/prisma/dev.db" \
  --from-literal=gemini-api-key="YOUR_GEMINI_KEY"

# 2. Apply deployment and service
kubectl apply -f k8s/deployment.yaml

# 3. Verify deployment status
kubectl rollout status deployment/civictwin-ai-deployment
```

---

## 6. Probes & Health Checks

CivicTwin AI exposes standard cloud-native Kubernetes probes:

| Endpoint | HTTP Method | Expected Status | Purpose |
| :--- | :---: | :---: | :--- |
| `/api/v1/health` | `GET` | `200 OK` | Comprehensive system health, uptime, memory, and database metrics. |
| `/api/v1/readiness` | `GET` | `200 OK` | Database connectivity readiness probe. Returns 503 if DB is unreachable. |
| `/api/v1/liveness` | `GET` | `200 OK` | Lightweight process liveness probe. |

---

## 7. Security & Compliance Architecture

1. **Helmet HTTP Headers**: Enforces `X-DNS-Prefetch-Control`, `X-Frame-Options`, `X-Content-Type-Options`, and `Strict-Transport-Security`.
2. **DPI Rate Limiting**: In-memory token-bucket limiter (300 requests/minute per IP) prevents API flood attacks on public intake endpoints. Returns HTTP 429 with `Retry-After`.
3. **Verbatim Input Preservation**: Citizen complaints in all 6 supported languages (`en`, `hi`, `bn`, `ta`, `te`, `mr`) are stored unaltered in native script with an immutable SHA-256 cryptographic audit digest.
4. **Zero AI Arithmetic**: All priority scores (0–100) and multi-factor weightings are calculated deterministically via server-side pure mathematics—never delegated to LLMs.
5. **Traceable Citations**: Every factual statement in generated evidence briefs must cite a verifiable evidence ID (`EV-...`) or is flagged for human review.

---

---

## 8. Host & Reverse Proxy Configuration

### 8.1 Production NGINX Configuration
Place in `/etc/nginx/sites-available/civictwin.conf`:

```nginx
upstream civictwin_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name civictwin.gov.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name civictwin.gov.in;

    ssl_certificate /etc/letsencrypt/live/civictwin.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/civictwin.gov.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Proxy to CivicTwin AI Express Application
    location / {
        proxy_pass http://civictwin_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
```

### 8.2 Systemd Service Unit
Place in `/etc/systemd/system/civictwin.service`:

```ini
[Unit]
Description=CivicTwin AI Production Platform
After=network.target

[Service]
Type=simple
User=civictwin
WorkingDirectory=/opt/civictwin-ai
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=/opt/civictwin-ai/.env
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable civictwin
sudo systemctl start civictwin
sudo systemctl status civictwin
```

---

## 9. Rollback & Disaster Recovery Procedures

1. **Blue/Green or Container Rollback**:
   ```bash
   # Revert to previous image tag
   kubectl rollout undo deployment/civictwin-ai-deployment
   # Or with Docker
   docker tag civictwin-ai:previous civictwin-ai:latest
   docker compose up -d
   ```
2. **Database Backup & Restoration**:
   ```bash
   # SQLite backup
   sqlite3 prisma/dev.db ".backup 'prisma/backup-$(date +%Y%m%d%H%M).db'"
   # Restore
   cp prisma/backup-202609301200.db prisma/dev.db
   ```

---

## 10. Post-Deployment Live Smoke Test

Run the following smoke test suite against the live deployment URL:

```bash
# 1. Health Probe (Comprehensive system state)
curl -s http://localhost:3001/api/v1/health | grep '"status":"HEALTHY"'

# 2. Readiness Probe (Database connectivity)
curl -s http://localhost:3001/api/v1/readiness | grep '"status":"READY"'

# 3. Liveness Probe (Process heartbeat)
curl -s http://localhost:3001/api/v1/liveness | grep '"status":"UP"'

# 4. Supported Languages (Strict 6-language DPI scope)
curl -s http://localhost:3001/api/v1/citizen/languages | grep '"count":6'

# 5. Multilingual Voice / Text Intake
curl -s -X POST http://localhost:3001/api/v1/citizen/requests \
  -H "Content-Type: application/json" \
  -d '{"originalText":"वाराणसी सिगरा सड़क पर गहरे गड्ढे और जलभराव है।","language":"hi","channel":"VOICE","location":{"address":"Sigra, Varanasi","latitude":25.3176,"longitude":82.9739}}' \
  | grep '"success":true'

# 6. Spatial Risk Radar Hotspots
curl -s http://localhost:3001/api/v1/radar/hotspots | grep '"success":true'

# 7. Priority Engine Calculation (Deterministic Math)
curl -s -X POST http://localhost:3001/api/v1/priority/calculate/HOT-UP-VNS-002 \
  -H "Content-Type: application/json" \
  -d '{"weights":{"affectedPopulation":0.25,"infrastructureGap":0.25,"urgencyTrend":0.20,"socialVulnerability":0.15,"budgetFeasibility":0.15}}' \
  | grep '"compositeScore"'

# 8. Grounded Evidence Brief Synthesis
curl -s -X POST http://localhost:3001/api/v1/briefs/generate/HOT-UP-VNS-002 | grep '"success":true'

# 9. Tamper-Evident SHA-256 Audit Trail
curl -s http://localhost:3001/api/v1/audit/logs?limit=1 | grep '"inputDigest"'
```
