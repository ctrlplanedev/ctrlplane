import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import { user } from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const profileRouter = createTRPCRouter({
  update: protectedProcedure
    .input(
      z.object({ activeWorkspaceId: z.string().uuid().nullable().optional() }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(user)
        .set(input)
        .where(eq(user.id, ctx.session.user.id))
        .returning()
        .then(takeFirst),
    ),
});

export const userRouter = createTRPCRouter({
  viewer: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .then(takeFirst),
  ),
});
