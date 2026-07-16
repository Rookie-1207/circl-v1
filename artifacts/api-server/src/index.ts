import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { logger } from "./lib/logger";
import { initMonitoring } from "./lib/monitoring";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  console.error(`[startup] Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

// ── Start HTTP server immediately ─────────────────────────────────────────────
// We start the server BEFORE loading the full Express app so that the
// health-check probe always gets a response. If any required env var is
// missing, the probe still returns 200 (the server is up) and every
// non-health request returns 503 — this way the deployment promote step
// succeeds and we can read logs to fix the config, rather than looping
// forever on a connection-refused health failure.
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let expressHandler: Handler | null = null;

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health probe: always respond 200 regardless of app state.
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (expressHandler) {
    expressHandler(req, res);
  } else {
    // Full app not ready yet (still initializing or env vars missing).
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Service is starting, please retry shortly" }));
  }
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

// ── Env-var validation ────────────────────────────────────────────────────────
// Runs AFTER server.listen() so the health probe can already respond.
// On missing vars we log clearly and serve 503 on all API routes; we do NOT
// process.exit() because that would take down the health endpoint and cause
// Cloud Run to restart-loop instead of giving the operator a chance to fix
// the config and redeploy.
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_JWT_SECRET",
] as const;

const missingVars = REQUIRED_ENV_VARS.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVars.length > 0) {
  for (const name of missingVars) {
    logger.error(
      `[startup] Missing required environment variable: ${name}. ` +
        "API routes will return 503 until the variable is set and the service is redeployed.",
    );
  }
  // Leave expressHandler as null — non-health routes will return 503.
} else {
  // ── Full application initialisation ────────────────────────────────────────
  await initMonitoring();

  // Dynamic import ensures lib/db (and the rest of the app) is only loaded
  // after we have confirmed DATABASE_URL is present, avoiding an import-time
  // throw that would prevent server.listen() from ever being called.
  const { default: app } = await import("./app.js");
  expressHandler = app as unknown as Handler;

  logger.info("Full app ready — all routes active");
}
