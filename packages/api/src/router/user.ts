import { hash } from "bcrypt";
import { omit } from "lodash";
import { v4 } from "uuid";
import { z } from "zod";

import { and, eq, takeFirst } from "@ctrlplane/db";
import { user, userApiKey } from "@ctrlplane/db/schema";

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

  apiKey: createTRPCRouter({
    revoke: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) =>
        ctx.db
          .delete(userApiKey)
          .where(
            and(
              eq(userApiKey.id, input),
              eq(userApiKey.userId, ctx.session.user.id),
            ),
          )
          .returning()
          .then(takeFirst),
      ),

    create: protectedProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const key = v4();

        const keyHash = await hash(key, 10);
        const apiKey = await ctx.db
          .insert(userApiKey)
          .values({
            ...input,
            userId: ctx.session.user.id,
            keyPreview: key.slice(0, 8),
            keyHash,
            expiresAt: null,
          })
          .returning()
          .then(takeFirst);
        return { ...input, key, id: apiKey.id };
      }),

    list: protectedProcedure.query(({ ctx }) =>
      ctx.db
        .select()
        .from(userApiKey)
        .where(eq(userApiKey.userId, ctx.session.user.id))
        .then((rows) => rows.map((row) => omit(row, "keyHash"))),
    ),
  }),
});
