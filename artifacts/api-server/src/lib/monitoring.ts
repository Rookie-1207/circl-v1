/**
 * Monitoring integration stubs.
 *
 * Set these environment variables in your deployment to activate each provider:
 *   SENTRY_DSN        — Sentry data-source name (https://docs.sentry.io/platforms/node/)
 *   POSTHOG_API_KEY   — PostHog project API key  (https://posthog.com/docs/libraries/node)
 *   BETTERSTACK_TOKEN — Better Stack source token (https://betterstack.com/docs/logs/)
 *
 * None are required. When absent the corresponding provider is silently skipped.
 * Install each package only when you are ready to activate it:
 *   Sentry:     pnpm --filter @workspace/api-server add @sentry/node
 *   PostHog:    pnpm --filter @workspace/api-server add posthog-node
 *   BetterStack: pnpm --filter @workspace/api-server add @logtail/pino
 */

// ── Sentry ────────────────────────────────────────────────────────────────────
// https://docs.sentry.io/platforms/node/
let sentryInitialized = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) return;

  try {
    // Dynamic string import avoids a static "module not found" TS error when
    // the package is not yet installed. The try/catch handles the runtime case.
    const pkg = "@sentry/node";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = await import(pkg as string) as any;
    Sentry.init({
      dsn,
      environment: process.env["NODE_ENV"] ?? "development",
      tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 1.0,
    });
    sentryInitialized = true;
    console.info("[monitoring] Sentry initialized");
  } catch {
    console.warn("[monitoring] @sentry/node not installed — Sentry skipped. Run: pnpm --filter @workspace/api-server add @sentry/node");
  }
}

export function captureException(err: unknown): void {
  if (!sentryInitialized) return;
  const pkg = "@sentry/node";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  import(pkg as string).then((Sentry: any) => Sentry.captureException(err)).catch(() => {});
}

// ── PostHog ───────────────────────────────────────────────────────────────────
// https://posthog.com/docs/libraries/node
// Install: pnpm --filter @workspace/api-server add posthog-node
let posthogClient: {
  capture: (args: { distinctId: string; event: string; properties?: Record<string, unknown> }) => void;
} | null = null;

export async function initPostHog(): Promise<void> {
  const apiKey = process.env["POSTHOG_API_KEY"];
  if (!apiKey) return;

  try {
    const pkg = "posthog-node";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PostHog } = await import(pkg as string) as any;
    posthogClient = new PostHog(apiKey, {
      host: process.env["POSTHOG_HOST"] ?? "https://app.posthog.com",
      flushAt: 20,
      flushInterval: 10_000,
    });
    console.info("[monitoring] PostHog initialized");
  } catch {
    console.warn("[monitoring] posthog-node not installed — PostHog skipped. Run: pnpm --filter @workspace/api-server add posthog-node");
  }
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  posthogClient?.capture({ distinctId, event, properties });
}

// ── Better Stack (Logtail) ────────────────────────────────────────────────────
// https://betterstack.com/docs/logs/javascript/
// Install: pnpm --filter @workspace/api-server add @logtail/pino
// Then pass the result of getBetterStackTransport() to your pino logger's `transport` option.
export function getBetterStackTransport(): object | null {
  const token = process.env["BETTERSTACK_TOKEN"];
  if (!token) return null;
  return {
    target: "@logtail/pino",
    options: { sourceToken: token },
  };
}

// ── Initialize all ────────────────────────────────────────────────────────────
export async function initMonitoring(): Promise<void> {
  await Promise.allSettled([initSentry(), initPostHog()]);
}
