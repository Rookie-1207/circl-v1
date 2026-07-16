import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/error-handler";

const app: Express = express();

// Trust the first proxy hop (Replit / Railway / Vercel all sit behind one).
// Required for rate-limiter to see real client IPs, not proxy IPs.
app.set("trust proxy", 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// contentSecurityPolicy disabled — pure JSON API, no HTML served.
// crossOriginResourcePolicy set to cross-origin so browser clients can read responses.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production set CORS_ORIGIN to a comma-separated list of allowed origins,
// e.g. "https://circl.app,https://www.circl.app".
// In development all origins are allowed.
const allowedOrigins = (process.env["CORS_ORIGIN"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      process.env["NODE_ENV"] === "production" && allowedOrigins.length > 0
        ? allowedOrigins
        : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Request logging ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    // Strip query strings and response bodies from logs to avoid leaking PII.
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Rate limiting ─────────────────────────────────────────────────────────────
// 500 requests per 15 minutes per IP. The health endpoint is excluded so
// load-balancer probes are never throttled.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: (req) => req.path === "/api/healthz",
});
app.use(limiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Explicit 1 MB limit prevents oversized-body DoS.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Root-level health check ───────────────────────────────────────────────────
// Replit's autoscale probe strips the artifact path prefix ("/api") before
// forwarding to the container, so the container receives GET /healthz, not
// GET /api/healthz. We expose it at both paths so the probe works in every
// environment (direct container access keeps /api/healthz; proxy strips it).
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Global error handler (must be registered last) ───────────────────────────
app.use(errorHandler);

export default app;
