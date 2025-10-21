import { TRPCError } from "@trpc/server";
import { hashSync } from "bcryptjs";
import { omit } from "lodash";
import { z } from "zod";

import { signOut } from "@ctrlplane/auth";
import { can, generateApiKey, hash } from "@ctrlplane/auth/utils";
import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { scopeType, updateUser, user, userApiKey } from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { signInSchema } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const profileRouter = createTRPCRouter({
  update: protectedProcedure
    .input(updateUser)
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(user)
        .set(input)
        .where(eq(user.id, ctx.session.user.id))
        .returning()
        .then(takeFirst),
    ),
});

const authRouter = createTRPCRouter({
  signOut: protectedProcedure.mutation(async () => {
    await signOut();
  }),
  signUp: publicProcedure
    .input(signInSchema.extend({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { email, password, name } = input;

      const user = await ctx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, email))
        .then(takeFirstOrNull);

      if (user != null)
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });

      const passwordHash = hashSync(password, 10);
      return db
        .insert(schema.user)
        .values({ name, email, passwordHash })
        .returning()
        .then(takeFirst);
    }),
});

export const userRouter = createTRPCRouter({
  auth: authRouter,
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
            keyPreview: prefix.slice(0, 10),
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
