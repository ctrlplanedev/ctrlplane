import { TRPCError } from "@trpc/server";

import type { AppError } from "./errorCodes";
import { ErrorCode } from "./errorCodes";

interface DatabaseError extends Error {
  code?: string;
  message: string;
  detail?: string;
  constraint?: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as any).message === "string"
  );
}

export const handleDatabaseError = (error: unknown): AppError => {
  if (!isDatabaseError(error)) {
    return {
      code: ErrorCode.UNEXPECTED_ERROR,
      message: "An unexpected error occurred.",
    };
  }

  switch (error.code) {
    case "23505":
      return {
        code: ErrorCode.UNIQUE_CONSTRAINT,
        message: "A unique constraint violation occurred.",
        details: { originalError: error },
      };
    case "23503":
      return {
        code: ErrorCode.FOREIGN_KEY_CONSTRAINT,
        message: "A foreign key constraint violation occurred.",
        details: { originalError: error },
      };
    default:
      return {
        code: ErrorCode.UNEXPECTED_ERROR,
        message: error.message || "An unexpected database error occurred.",
        details: { originalError: error },
      };
  }
};

export const appErrorToTRPCError = (appError: AppError): TRPCError => {
  const trpcErrorCode = (() => {
    switch (appError.code) {
      case ErrorCode.VALIDATION_ERROR:
        return "BAD_REQUEST";
      case ErrorCode.UNIQUE_CONSTRAINT:
        return "CONFLICT";
      case ErrorCode.FOREIGN_KEY_CONSTRAINT:
        return "BAD_REQUEST";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  })();

  return new TRPCError({
    code: trpcErrorCode,
    message: appError.message,
    cause: appError,
  });
};
