import type { Request, Response } from "express";
import { ApiError } from "@/types/api.js";

import { logger } from "@ctrlplane/logger";

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 *
 * Note: Must have 4 parameters for Express to recognize it as an error handler
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: any,
) => {
  // Log the error
  logger.error("API Error", {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // Handle ApiError instances
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Handle validation errors from express-openapi-validator
  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details: (error as any).errors,
    });
  }

  // Handle generic errors
  return res
    .status(500)
    .json({ message: "Internal server error", code: "INTERNAL_ERROR" });
};
