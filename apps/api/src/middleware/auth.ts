import type { ApiRequest } from "@/types/api.js";
import type { NextFunction, Response } from "express";
import { getSession } from "@/auth.js";
import { UnauthorizedError } from "@/types/api.js";

/**
 * Authentication middleware that validates the session
 * and attaches user context to the request
 */
export const requireAuth = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await getSession(req);

    if (!session?.user?.id) {
      throw new UnauthorizedError("Authentication required");
    }

    // Attach context to request
    req.apiContext = {
      session,
      userId: session.user.id,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(error.statusCode).json(error.toJSON());
    } else {
      res.status(401).json({
        message: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }
  }
};

/**
 * Optional authentication middleware that attaches session if available
 * but doesn't require it
 */
export const optionalAuth = async (
  req: ApiRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await getSession(req);

    req.apiContext = {
      session: session ?? null,
      userId: session?.user?.id,
    };

    next();
  } catch (error) {
    // If auth fails, continue without session
    req.apiContext = {
      session: null,
    };
    next();
  }
};
