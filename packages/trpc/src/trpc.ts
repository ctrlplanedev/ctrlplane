import type { Session } from "@ctrlplane/auth/server";
import type { PermissionChecker } from "@ctrlplane/auth/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import { can } from "@ctrlplane/auth/utils";
import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

export const createTRPCContext = (session: Session | null) => {
  return { db, session };
};

export type AuthorizationCheckFunc<T = any> = (opts: {
  ctx: Context & { session: Session };
  input: T;
  canUser: PermissionChecker;
}) => boolean | Promise<boolean | null>;

export type Meta = {
  authorizationCheck?: AuthorizationCheckFunc;
};

export type Context = ReturnType<typeof createTRPCContext>;

const t = initTRPC
  .context<Context>()
  .meta<Meta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });

export const router = t.router;
export const publicProcedure = t.procedure;

const authnProcedure = publicProcedure.use(({ ctx, next }) => {
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
    if (user.systemRole === "admin") return next();

    const { authorizationCheck } = meta ?? {};
    if (authorizationCheck != null) {
      const canUser = can().user(ctx.session.user.id);

      const input = await getRawInput();
      let check: boolean | null = null;
      try {
        check = await authorizationCheck({ ctx, input, canUser });
      } catch (e: any) {
        console.error(e);
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
