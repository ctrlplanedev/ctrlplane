import type { Session } from "@ctrlplane/auth";
import type { ScopeType } from "@ctrlplane/db/schema";
import type { Permission } from "@ctrlplane/validators/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { checkEntityPermissionForResource } from "@ctrlplane/auth/utils";
import { db } from "@ctrlplane/db/client";

export const createTRPCContext = (opts: {
  headers: Headers;
  session: Session | null;
}) => {
  const session = opts.session;
  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  console.log(">>> tRPC Request from", source, "by", session?.user.email);

  return { session, db };
};

export type Context = ReturnType<typeof createTRPCContext>;

type Scope = { type: ScopeType; id: string };
export type Meta = {
  operation?: (opts: {
    ctx: Context & { session: Session };
    input: any;
  }) =>
    | [Scope | Scope[], Permission[]]
    | Promise<[Scope | Scope[], Permission[]]>;
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

const authnProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const authzProdecdure = authnProcedure.use(
  async ({ ctx, meta, getRawInput, next }) => {
    const { operation } = meta ?? {};
    if (operation != null) {
      const input = await getRawInput();

      const [scopeS, permissions] = await operation({ ctx, input });
      const scopes = Array.isArray(scopeS) ? scopeS : [scopeS];
      const check = await Promise.all(
        scopes.map(async (scope) =>
          checkEntityPermissionForResource(
            { type: "user", id: ctx.session.user.id },
            scope,
            permissions,
          ),
        ),
      );

      if (!check.every((c) => c))
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You do not have the required permissions for this operation.`,
        });
    }
    return next();
  },
);

export const protectedProcedure = authzProdecdure;
