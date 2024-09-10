import { omit } from "lodash";
import { z } from "zod";

import { can, generateApiKey, hash } from "@ctrlplane/auth/utils";
import { and, eq, takeFirst } from "@ctrlplane/db";
import { scopeType, user, userApiKey } from "@ctrlplane/db/schema";

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
  can: protectedProcedure
    .input(
      z.object({
        action: z.string(),
        resource: z.object({
          type: z.enum(scopeType.enumValues),
          id: z.string().uuid(),
        }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { action, resource } = input;
      return can().user(ctx.session.user.id).perform(action).on(resource);
    }),

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
        const { prefix, apiKey: key, secret } = generateApiKey();

        const apiKey = await ctx.db
          .insert(userApiKey)
          .values({
            ...input,
            userId: ctx.session.user.id,
            keyPreview: key.slice(-8),
            keyHash: hash(secret),
            keyPrefix: prefix,
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
