import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "INFO",
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip
    }));
  });

  next();
}
