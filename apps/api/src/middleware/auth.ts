import type { ApiRequest } from "@/types/api.js";
import type { NextFunction, Response } from "express";
import { getSession } from "@/auth.js";
import { UnauthorizedError } from "@/types/api.js";

import { getUser as getUserByApiKey } from "@ctrlplane/auth/utils";
import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { user } from "@ctrlplane/db/schema";

/**
 * Authentication middleware that validates the session or API key
 * and attaches user context to the request
 */
export const requireAuth = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Try API key authentication first (priority)
    const apiKey = req.headers["x-api-key"];
    if (apiKey && typeof apiKey === "string") {
      const apiUser = await getUserByApiKey(apiKey);
      if (apiUser) {
        req.apiContext = {
          db,
          authMethod: "api-key",
          session: null,
          user: apiUser,
        };
        return next();
      }
    }

    // 2. Fall back to session authentication
    const session = await getSession(req);

    if (!session?.user.id)
      throw new UnauthorizedError("Authentication required");

    // Fetch full user from database
    const sessionUser = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!sessionUser) {
      throw new UnauthorizedError("User not found");
    }

    // Attach context to request
    req.apiContext = {
      db,
      authMethod: "session",
      session,
      user: sessionUser,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(error.statusCode).json(error.toJSON());
      return;
    }

    res.status(401).json({
      message: "Authentication failed",
      code: "AUTH_FAILED",
    });
  }
};

/**
 * Optional authentication middleware that attaches session or API key if available
 * but doesn't require it
 */
export const optionalAuth = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Try API key authentication first (priority)
    const apiKey = req.headers["x-api-key"];
    if (apiKey && typeof apiKey === "string") {
      const apiUser = await getUserByApiKey(apiKey);
      if (apiUser) {
        req.apiContext = {
          db,
          authMethod: "api-key",
          session: null,
          user: apiUser,
        };
        return next();
      }
    }

    // 2. Fall back to session authentication
    const session = await getSession(req);

    if (session?.user.id) {
      // Fetch full user from database
      const sessionUser = await db
        .select()
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1)
        .then((rows) => rows[0]);

      if (sessionUser) {
        req.apiContext = {
          db,
          authMethod: "session",
          session,
          user: sessionUser,
        };
        return next();
      }
    }

    // If no auth available, continue without context
    next();
  } catch {
    // If auth fails, continue without context
    next();
  }
};
