import type { auth } from "@ctrlplane/auth/server";
import type { PermissionChecker } from "@ctrlplane/auth/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import _ from "lodash";
import superjson from "superjson";
import { isPresent } from "ts-is-present";
import { ZodError } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger, makeWithSpan, SpanStatusCode, trace } from "@ctrlplane/logger";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export const createTRPCContext = (opts: {
  headers: Headers;
  session: Session | null;
}) => {
  logger.info("createTRPCContext", { opts });
  const session = opts.session;
  const trpcSource = opts.headers.get("x-trpc-source") ?? "unknown";
  return { trpcSource, session, db };
};

export type Context = ReturnType<typeof createTRPCContext>;

export type AuthorizationCheckFunc<T = any> = (opts: {
  ctx: Context & { session: Session };
  input: T;
  canUser: PermissionChecker;
}) => boolean | Promise<boolean | null>;
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
  if (!result.ok) {
    logger.error(message, meta);
    return result;
  }

  if (durationMs > 100) {
    logger.warn(message, meta);
    return result;
  }

  logger.debug(message, meta);
  return result;
});

const tracer = trace.getTracer("trpc");
const { createSpanWrapper: withSpan } = makeWithSpan(tracer);
const spanProcedure = loggedProcedure.use(
  withSpan("trpc", async (span, { ctx, next, ...rest }) => {
    span.setAttribute("trpc.path", rest.path);
    span.setAttribute("trpc.type", rest.type);
    span.setAttribute("trpc.source", ctx.trpcSource);

    const t = await next({ ctx: { ...ctx, span } });

    span.setAttribute("trpc.ok", t.ok);
    if (!t.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttributes({
        "trpc.error.name": t.error.name,
        "trpc.error.message": t.error.message,
        "trpc.error.code": t.error.code,
      });
    }
    return t;
  }),
);

export const publicProcedure = spanProcedure;

const authnProcedure = spanProcedure.use(({ ctx, next }) => {
  if (ctx.session == null) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const authzProcedure = authnProcedure.use(
  async ({ ctx, meta, path, getRawInput, next }) => {
    const user = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, ctx.session.user.id))
      .then(takeFirst);
    logger.info("user", { user });
    if (user.systemRole === "admin") return next();

    const { authorizationCheck } = meta ?? {};
    if (authorizationCheck != null) {
      const canUser = can().user(ctx.session.user.id);

      const input = await getRawInput();
      let check: boolean | null = null;
      try {
        check = await authorizationCheck({ ctx, input, canUser });
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An internal error occurred during authorization check",
          cause: e,
        });
      }

      if (check == null) return next();

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
