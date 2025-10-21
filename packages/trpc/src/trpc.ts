import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import { db } from "@ctrlplane/db/client";

export const createTRPCContext = () => {
  return { db };
};

export type Context = ReturnType<typeof createTRPCContext>;

const t = initTRPC.context<Context>().create({
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

export const appRouter = router({
  user: router({
    profile: router({
      update: t.procedure.mutation(({ ctx, input }) => {
        return true;
      }),
    }),
  }),
});
