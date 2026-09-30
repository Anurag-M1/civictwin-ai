# Deploying CivicTwin AI to Vercel

CivicTwin AI is fully configured for deployment on **Vercel** as a full-stack application (Vite React SPA + Express Serverless Functions).

---

### How CivicTwin Runs on Vercel

1. **Frontend:** Built via `vite build` into `dist/client`, served statically via Vercel's Edge Network CDN.
2. **Backend API:** Handled by `api/index.ts` wrapping the Express REST API (`/api/v1/*`) inside a Vercel Serverless Function.
3. **Database & Persistence:**
   - On Vercel serverless environments, the root filesystem is read-only.
   - CivicTwin AI automatically copies the pre-seeded SQLite database from `prisma/dev.db` into the writable `/tmp/dev.db` partition on instance startup.
   - This ensures all write operations (**Citizen Signals Ingestion**, **What-If Simulations**, and **Human Reviews**) succeed without `EROFS: read-only file system` errors.
   - If an external `DATABASE_URL` environment variable is provided (e.g. Supabase, Turso, or Neon Postgres), Prisma will connect to that instead.

---

### Step-by-Step Deployment Instructions

#### Method 1: Deploy via GitHub (Recommended)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Configure Vercel serverless deployment"
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com/) and click **"Add New..."** → **"Project"**.
3. Import your GitHub repository.
4. In the Project Settings:
   - **Framework Preset:** Vite (or Other)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist/client`
5. *(Optional)* Add Environment Variables:
   - `GEMINI_API_KEY`: Your Google Gemini API Key (if using live Gemini API; defaults to deterministic fallback if omitted).
   - `JWT_SECRET`: Any random 32+ character string.
   - `DEMO_ADMIN_API_KEY`: Secret API key for administrative endpoints.
6. Click **Deploy**.

---

#### Method 2: Deploy via Vercel CLI

1. Install the Vercel CLI globally (if not already installed):
   ```bash
   npm install -g vercel
   ```
2. Run the deployment command from the project root:
   ```bash
   vercel
   ```
3. Follow the CLI prompts (accept defaults for Vite and `dist/client`).
4. For production deployment:
   ```bash
   vercel --prod
   ```

---

### Verification After Deployment

Once deployed, verify the live deployment by hitting the health endpoint:
```bash
curl https://<your-vercel-domain>.vercel.app/api/v1/health
```

Expected response:
```json
{
  "status": "HEALTHY",
  "database": "CONNECTED",
  "gemini": { "status": "ONLINE", "model": "gemini-2.0-flash" }
}
```
