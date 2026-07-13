import app from "./app";
import { logger } from "./lib/logger";
import { initMonitoring } from "./lib/monitoring";

// ── Startup environment validation ────────────────────────────────────────────
// Fail fast with a clear message rather than crashing on the first request.
const REQUIRED_ENV_VARS = ["PORT", "DATABASE_URL", "SUPABASE_URL", "SUPABASE_JWT_SECRET"] as const;

for (const name of REQUIRED_ENV_VARS) {
  if (!process.env[name]?.trim()) {
    // Use console.error so this surfaces even before pino is fully configured.
    console.error(`[startup] Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const rawPort = process.env["PORT"]!;
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  console.error(`[startup] Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

// ── Monitoring ────────────────────────────────────────────────────────────────
// Initialises Sentry, PostHog, etc. when the corresponding env vars are set.
// Runs before the server starts so all requests are captured from the first one.
await initMonitoring();

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
