# Deployment Guide

## Architecture

```
Browser / Mobile
      │
      ▼
  Frontend (React + Vite)          ← Deploy to Vercel / Netlify / Replit
      │ REST API calls
      ▼
  API Server (Express + Node.js)   ← Deploy to Railway / Fly.io / Docker
      │
      ▼
  PostgreSQL                        ← Supabase (hosted) or Railway
      │
  Supabase Auth                     ← Supabase project (JWT issuer)
```

---

## Environment Variables

Copy `.env.example` and fill in all **Required** values before deploying.

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | ✅ | Port the API server binds to |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_JWT_SECRET` | ✅ | Supabase JWT secret (from Dashboard → Settings → API) |
| `CORS_ORIGIN` | Production | Comma-separated allowed frontend origins |
| `SENTRY_DSN` | Optional | Sentry error tracking DSN |
| `POSTHOG_API_KEY` | Optional | PostHog analytics key |
| `BETTERSTACK_TOKEN` | Optional | Better Stack log shipping token |

---

## Deploy to Railway (recommended)

1. Push code to GitHub.
2. Create a new Railway project and connect the repository.
3. Add a PostgreSQL service in Railway — copy the `DATABASE_URL`.
4. Set all required environment variables in Railway's Variables tab.
5. Set `CORS_ORIGIN` to your Vercel frontend URL.
6. Railway auto-detects the `Dockerfile` and builds the API server.
7. Run the DB migration once:
   ```bash
   railway run pnpm --filter @workspace/db run push
   ```

---

## Deploy Frontend to Vercel

1. Import the repository in Vercel.
2. Set **Framework Preset** to `Vite`.
3. Set **Root Directory** to `artifacts/circl`.
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

---

## Docker (self-hosted)

```bash
# Build
docker build -t circl-api .

# Run
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL="postgresql://..." \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_JWT_SECRET="your-secret" \
  -e CORS_ORIGIN="https://your-frontend.com" \
  --name circl-api \
  circl-api
```

Health check endpoint: `GET /api/healthz`

---

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Authentication → Providers → Email**, disable "Confirm email" for development.
3. Copy **Project URL** → `SUPABASE_URL`
4. Copy **Settings → API → JWT Secret** → `SUPABASE_JWT_SECRET`
5. Copy **Settings → API → anon key** → `VITE_SUPABASE_ANON_KEY`

---

## Database Migrations

The project uses Drizzle ORM in push mode.

```bash
# Apply schema to a database
pnpm --filter @workspace/db run push

# Generate a SQL migration file (optional, for audit trail)
pnpm --filter @workspace/db run generate
```

---

## CI/CD

GitHub Actions runs on every push to `main`:
- `pnpm install --frozen-lockfile`
- TypeScript typecheck (api-server, circl, db)
- Build (api-server, circl)
- Tests (api-server)

See `.github/workflows/ci.yml`.
