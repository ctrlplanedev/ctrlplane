export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNIQUE_CONSTRAINT: "UNIQUE_CONSTRAINT",
  FOREIGN_KEY_CONSTRAINT: "FOREIGN_KEY_CONSTRAINT",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppError = {
  code: ErrorCodeType;
  message: string;
  details?: Record<string, unknown>;
};
