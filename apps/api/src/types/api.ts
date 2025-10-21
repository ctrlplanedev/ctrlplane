import type { Request as ExpressRequest, Response } from "express";
import type { Session } from "next-auth";
import type OpenAPIBackend from "openapi-backend";

import type { paths } from "./openapi.js";

/**
 * Context available to all route handlers
 */
export interface ApiContext {
  session: Session | null;
  userId?: string;
}

/**
 * Extended Express request with API context
 */
export interface ApiRequest extends ExpressRequest {
  apiContext?: ApiContext;
}

/**
 * Handler function type for OpenAPI Backend
 */
export type Handler = (
  c: Parameters<Parameters<OpenAPIBackend["register"]>[0][string]>[0],
  req: ApiRequest,
  res: Response,
) => Promise<void> | void;

/**
 * Utility type to extract path parameters from an OpenAPI path
 * Example: ExtractPathParams<"/v1/users/{userId}"> => { userId: string }
 */
export type ExtractPathParams<T extends string> =
  T extends `${infer _Start}/{${infer Param}}/${infer Rest}`
    ? { [K in Param]: string } & ExtractPathParams<`/${Rest}`>
    : T extends `${infer _Start}/{${infer Param}}`
      ? { [K in Param]: string }
      : Record<string, never>;

/**
 * Helper type to get request body type from a path and method
 */
export type RequestBody<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
> = paths[TPath][TMethod] extends { requestBody: { content: infer Content } }
  ? Content extends { "application/json": infer Body }
    ? Body
    : never
  : never;

/**
 * Helper type to get response body type from a path, method, and status code
 */
export type ResponseBody<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
  TStatus extends number = 200,
> = paths[TPath][TMethod] extends { responses: infer Responses }
  ? Responses extends { [K in TStatus]: infer Response }
    ? Response extends { content: { "application/json": infer Body } }
      ? Body
      : never
    : never
  : never;

/**
 * Helper type to get query parameters from a path and method
 */
export type QueryParams<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
> = paths[TPath][TMethod] extends { parameters: { query?: infer Query } }
  ? Query
  : Record<string, never>;

/**
 * Error response type
 */
export interface ErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard API error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON(): ErrorResponse {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Predefined API errors
 */
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad request", details?: Record<string, unknown>) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * Type-safe response sender
 */
export function sendResponse<T>(res: Response, statusCode: number, data: T) {
  res.status(statusCode).json(data);
}

/**
 * Type-safe error response sender
 */
export function sendError(res: Response, error: ApiError | Error) {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json(error.toJSON());
  } else {
    res.status(500).json({
      message: error.message || "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}
