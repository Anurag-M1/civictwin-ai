# CivicTwin AI — Environment & Configuration Specification

This document details all configuration parameters, security considerations, secret management practices, and environment variable requirements for deploying CivicTwin AI in production environments.

---

## 1. Environment Variables Matrix

| Parameter | Required | Type | Default | Description | Security Constraints |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `NODE_ENV` | Optional | Enum | `production` | Runtime mode: `production`, `development`, or `test`. | When set to `production`, debug headers and stack traces are suppressed. |
| `PORT` | Optional | Integer | `3001` | TCP port where Express listens for incoming HTTP connections. | Ensure port is not exposed directly to WAN without a reverse proxy. |
| `DATABASE_URL` | **Yes** | String | `file:./dev.db` | Prisma datasource URI. Supports SQLite (`file:...`) and PostgreSQL (`postgresql://...`). | Must be restricted via VPC / file system permissions (`chmod 600`). |
| `GEMINI_API_KEY` | Optional | String | `""` | Google AI Studio / Vertex AI Gemini API key. | Never commit to source control. Injected via Kubernetes Secret or Vault. |
| `GEMINI_MODEL` | Optional | String | `gemini-2.0-flash` | Gemini foundation model identifier for inference and synthesis. | Must be a tested Google GenAI model (`gemini-2.0-flash`, `gemini-1.5-flash`). |
| `SESSION_SECRET` | **Yes** | String | — | Cryptographic salt for cookie signing and internal HMAC hash derivation. | Must be high-entropy, min 32 characters (`openssl rand -hex 32`). |
| `ALLOWED_ORIGINS` | Optional | String | `http://localhost:3000,http://localhost:3001` | Comma-separated whitelist of allowed CORS origins. | Required in production to prevent cross-origin request forgery. |
| `RATE_LIMIT_MAX` | Optional | Integer | `300` | Max requests allowed per IP within the rate-limiting window. | Prevents denial of service and API endpoint scraping. |
| `RATE_LIMIT_WINDOW_MS` | Optional | Integer | `60000` | Rate-limiting sliding window in milliseconds (default: 1 minute). | Configurable based on upstream load balancer sizing. |

---

## 2. Configuration Files & Discovery

- **`.env`**: Local active environment file loaded by `dotenv` at runtime.
- **`.env.example`**: Standardized blueprint template for operators and DevOps engineers.
- **`src/config/index.ts`**: Validates environment variables, provides strongly-typed fallbacks, and calculates derived parameters.

---

## 3. Secret Management & Rotation Guidelines

1. **API Keys**:
   - `GEMINI_API_KEY`: Rotate periodically via Google Cloud Console / AI Studio. If the key is rotated or temporarily invalid, the platform gracefully switches to the deterministic offline NLP fallback without dropping citizen grievance requests.
2. **Session Secrets**:
   - `SESSION_SECRET`: When rotating `SESSION_SECRET`, existing sessions will be invalidated. Schedule rotations during planned maintenance windows.
3. **Database Credentials**:
   - For PostgreSQL deployments, use connection pooling (e.g., PgBouncer) and enforce SSL encryption (`sslmode=require`).

---

## 4. Reverse Proxy & Container Networking

When deploying behind reverse proxies such as NGINX, HAProxy, or AWS ALB:
- CivicTwin AI has `app.set('trust proxy', 1)` enabled.
- Upstream proxies **MUST** pass:
  - `X-Forwarded-For`: Actual client IP address.
  - `X-Forwarded-Proto`: Protocol scheme (`https`).
  - `X-Request-Id`: Unique request correlation ID (if omitted, CivicTwin AI generates a random UUID).
