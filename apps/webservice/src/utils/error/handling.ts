// import type { AppError } from "@ctrlplane/api";
// import { TRPCClientError } from "@trpc/client";

// import { ErrorCode } from "@ctrlplane/api";

// type ErrorHandler = (appError: AppError) => void;

// export const handleTRPCError = (
//   error: unknown,
//   errorHandlers: Partial<Record<keyof typeof ErrorCode, ErrorHandler>>,
//   defaultHandler?: ErrorHandler,
// ) => {
//   const appError = extractAppError(error);
//   const handler = errorHandlers[appError.code];

//   if (handler) {
//     handler(appError);
//   } else if (defaultHandler) {
//     defaultHandler(appError);
//   }
// };

// function extractAppError(error: unknown): AppError {
//   if (
//     error instanceof TRPCClientError &&
//     typeof error.data === "object" &&
//     error.data !== null &&
//     "appError" in error.data &&
//     isAppError(error.data.appError)
//   ) {
//     return error.data.appError;
//   }
//   return createUnexpectedError();
// }

// // Add this helper function
// function isAppError(error: unknown): error is AppError {
//   return (
//     typeof error === "object" &&
//     error !== null &&
//     "code" in error &&
//     "message" in error
//   );
// }

// function createUnexpectedError(): AppError {
//   return {
//     code: ErrorCode.UNEXPECTED_ERROR,
//     message: "An unexpected error occurred",
//   };
// }
