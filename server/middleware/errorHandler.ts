import { Request, Response, NextFunction } from "express";

export interface CustomError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;

  // Structured Error Logging (full detail server-side only)
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "ERROR",
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  }));

  // In production, hide internal details for unexpected server errors
  const isProd = process.env.NODE_ENV === "production";
  const message = (!isProd || err.statusCode) ? (err.message || "Interne serverfout") : "Interne serverfout";

  res.status(statusCode).json({
    error: message,
    statusCode
  });
}
