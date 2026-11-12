import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export function userIdFromRequest(req: Request): string | undefined {
  const auth = getAuth(req);
  return auth?.userId || undefined;
}

export const requireUser: RequestHandler = (req, res, next) => {
  if (!userIdFromRequest(req)) {
    res.status(401).json({ error: "Sign in to continue" });
    return;
  }
  next();
};
