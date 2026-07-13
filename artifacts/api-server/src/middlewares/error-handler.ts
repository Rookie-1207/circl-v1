import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(String(value));
}

function getStatusCode(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    if ("statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number") {
      return (err as { statusCode: number }).statusCode;
    }
    if ("status" in err && typeof (err as { status: unknown }).status === "number") {
      return (err as { status: number }).status;
    }
  }
  return 500;
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const status = getStatusCode(err);
  const error = toError(err);

  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } }, "Unhandled server error");
  } else {
    logger.warn({ err, req: { method: req.method, url: req.url } }, "Client error");
  }

  if (res.headersSent) return;

  const isProduction = process.env["NODE_ENV"] === "production";

  res.status(status).json({
    error: status >= 500 && isProduction ? "Internal server error" : error.message,
    ...(isProduction ? {} : { stack: error.stack }),
  });
};
