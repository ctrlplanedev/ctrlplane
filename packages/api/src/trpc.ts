import type { Session } from "@ctrlplane/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@ctrlplane/db/client";

import type { AppError } from "./errorCodes";
import { accessQuery } from "./auth/access-query";
import { appErrorToTRPCError, handleDatabaseError } from "./dbErrors";
import { ErrorCode } from "./errorCodes";

export const createTRPCContext = (opts: {
  headers: Headers;
  session: Session | null;
}) => {
  const session = opts.session;
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  console.log(">>> tRPC Request from", source, "by", session?.user.email);

  return {
    session,
    db,
    accessQuery: () => accessQuery(db, session?.user.id),
  };
};

export type Context = ReturnType<typeof createTRPCContext>;
export type Meta = {
  permission?: string;
  access?: (opts: {
    ctx: Context & { session: Session };
    input: any;
  }) => boolean | Promise<boolean>;
};

const t = initTRPC
  .context<Context>()
  .meta<Meta>()
  .create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => {
      let appError: AppError;

      if (error.cause instanceof ZodError) {
        appError = {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Validation error",
          details: { zodError: error.cause.flatten() },
        };
      } else if (error.cause) {
        appError = handleDatabaseError(error.cause);
      } else {
        appError = {
          code: ErrorCode.UNEXPECTED_ERROR,
          message: error.message,
        };
      }

      const trpcError = appErrorToTRPCError(appError);

      return {
        ...shape,
        data: {
          ...shape.data,
          appError,
        },
        message: trpcError.message,
        code: trpcError.code,
      };
    },
  });

export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const validatePermission = (statement: string, perm: string) => {
  // Escape special regex characters in the statement except '*'
  const escapedStatement = statement
    .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escapedStatement}$`);
  return regex.test(perm);
};

export const authenticatedProcedure = t.procedure.use(({ ctx, next, meta }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });

  const { permission } = meta ?? {};
  if (permission != null) {
    if (!validatePermission("*", permission))
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You need to have permission: ${permission}`,
      });
  }

  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = authenticatedProcedure.use(
  async ({ ctx, next, meta, getRawInput }) => {
    const { access } = meta ?? {};
    if (access != null) {
      const input = await getRawInput();
      const hasPermission = await access({ ctx, input });
      if (!hasPermission) throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next();
  },
);
