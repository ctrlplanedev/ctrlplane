import type { Session } from "@ctrlplane/auth";
import type { PermissionChecker } from "@ctrlplane/auth/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import _ from "lodash";
import superjson from "superjson";
import { isPresent } from "ts-is-present";
import { ZodError } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { db } from "@ctrlplane/db/client";
import { logger } from "@ctrlplane/logger";

export const createTRPCContext = (opts: {
  headers: Headers;
  session: Session | null;
}) => {
  const session = opts.session;
  const trpcSource = opts.headers.get("x-trpc-source") ?? "unknown";
  return { trpcSource, session, db };
};

export type Context = ReturnType<typeof createTRPCContext>;

export type AuthorizationCheckFunc<T = any> = (opts: {
  ctx: Context & { session: Session };
  input: T;
  canUser: PermissionChecker;
}) => boolean | Promise<boolean>;
export type Meta = {
  authorizationCheck?: AuthorizationCheckFunc;
};

const t = initTRPC
  .context<Context>()
  .meta<Meta>()
  .create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }),
  });

export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

export const loggedProcedure = t.procedure.use(async (opts) => {
  const start = Date.now();

  const result = await opts.next();

  const durationMs = Date.now() - start;

  const session = opts.ctx.session;
  const email = session?.user.email ?? "unknown";
  const source = opts.ctx.trpcSource;
  const error =
    result.ok === false
      ? _.pickBy(
          {
            code: result.error.code,
            name: result.error.name,
            message: result.error.message,
            cause: result.error.cause,
            stack: result.error.stack,
          },
          isPresent,
        )
      : null;

  const meta = {
    label: "trpc",
    path: opts.path,
    type: opts.type,
    durationMs,
    ok: result.ok,
    ...(error != null && { error }),
  };

  const message = `${result.ok ? "OK" : "NOT OK"} - request from ${source} by ${email}`;
  if (durationMs > 100 || !result.ok) {
    logger.warn(message, meta);
    return result;
  }

  logger.info(message, meta);
  return result;
});

export const publicProcedure = loggedProcedure;

const authnProcedure = loggedProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const authzProcedure = authnProcedure.use(
  async ({ ctx, meta, path, getRawInput, next }) => {
    const { authorizationCheck } = meta ?? {};
    if (authorizationCheck != null) {
      const canUser = can().user(ctx.session.user.id);
      const input = await getRawInput();
      let check = false;
      try {
        check = await authorizationCheck({ ctx, input, canUser });
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An internal error occurred during authorization check",
          cause: e,
        });
      }

      if (!check)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You do not have the required permissions for '${path}' operation.`,
        });
    }

    return next();
  },
);

export const protectedProcedure = authzProcedure;
