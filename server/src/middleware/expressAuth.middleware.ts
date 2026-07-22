import type { Request, Response, NextFunction } from "express";
import { verifySupabaseToken, type TokenPayload } from "./auth.middleware.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = authHeader.slice(7);
    const payload = await verifySupabaseToken(token);

    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || "Authentication failed" });
  }
}
