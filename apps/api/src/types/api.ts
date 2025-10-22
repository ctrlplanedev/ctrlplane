import type { db } from "@ctrlplane/db/client";
import type { User } from "@ctrlplane/db/schema";
import type { Request as ExpressRequest, Response } from "express";
import type { Session } from "next-auth";

import type { paths } from "./openapi.js";

/**
 * Context available to all route handlers
 * Uses discriminated union for type-safe auth method handling
 */
export type ApiContext = { db: typeof db } & (
  | {
      authMethod: "session";
      session: Session; // strongly typed as not null when using session auth
      user: User;
    }
  | {
      authMethod: "api-key";
      session: null;
      user: User;
    }
);

/**
 * Extended Express request with API context
 */
export interface ApiRequest extends ExpressRequest {
  apiContext?: ApiContext;
}

/**
 * Utility type to extract path parameters from an OpenAPI path
 * Example: ExtractPathParams<"/v1/users/{userId}"> => { userId: string }
 *
 * Note: Uses mapped types which ESLint flags but are necessary for extracting
 * dynamic keys from template literal types.
 */
/* eslint-disable @typescript-eslint/consistent-indexed-object-style */
export type ExtractPathParams<T extends string> =
  T extends `${string}/{${infer Param}}/${infer Rest}`
    ? { [K in Param]: string } & ExtractPathParams<`/${Rest}`>
    : T extends `${string}/{${infer Param}}`
      ? { [K in Param]: string }
      : Record<string, never>;
/* eslint-enable @typescript-eslint/consistent-indexed-object-style */

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
  ? Responses extends Record<TStatus, infer Response>
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
 * Helper type to get path parameters from a path and method
 */
export type PathParams<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
> = paths[TPath][TMethod] extends { parameters: { path: infer Params } }
  ? Params
  : ExtractPathParams<TPath & string>;

/**
 * Strongly-typed Express request for a specific path and method
 */
export interface TypedRequest<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
> extends Omit<ApiRequest, "body" | "query" | "params"> {
  body: RequestBody<TPath, TMethod>;
  query: QueryParams<TPath, TMethod>;
  params: PathParams<TPath, TMethod>;
}

/**
 * Strongly-typed handler for a specific path and method
 * Usage: TypedHandler<'/v1/users', 'post'>
 * This will automatically type the request body, query params, path params, and response
 */
export type TypedHandler<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
> = (req: TypedRequest<TPath, TMethod>, res: Response) => Promise<void> | void;

/**
 * Strongly-typed async handler for a specific path and method
 * Usage: AsyncTypedHandler<'/v1/users', 'post'>
 * This will automatically type the request body, query params, path params, and response
 */
export type AsyncTypedHandler<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
> = (req: TypedRequest<TPath, TMethod>, res: Response) => Promise<void>;

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
    public statusCode = 500,
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

/**
 * Wrap async handlers to catch errors and pass to error middleware
 */
export function asyncHandler<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
>(handler: AsyncTypedHandler<TPath, TMethod>) {
  return (req: ApiRequest, res: Response, next: (error?: unknown) => void) => {
    Promise.resolve(handler(req as TypedRequest<TPath, TMethod>, res)).catch(
      next,
    );
  };
}

/**
 * Wrap sync handlers to catch errors and pass to error middleware
 */
export function syncHandler<
  TPath extends keyof paths,
  TMethod extends keyof paths[TPath],
>(handler: TypedHandler<TPath, TMethod>) {
  return (req: ApiRequest, res: Response, next: (error?: unknown) => void) => {
    try {
      const result = handler(req as TypedRequest<TPath, TMethod>, res);
      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (error: unknown) {
      next(error);
    }
  };
}
