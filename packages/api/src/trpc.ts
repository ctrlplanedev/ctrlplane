import type { Session } from "@ctrlplane/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { accessQuery } from "@ctrlplane/auth";
import { db } from "@ctrlplane/db/client";

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
