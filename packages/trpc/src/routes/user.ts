import _ from "lodash";
import { z } from "zod";

import { generateApiKey, hash } from "@ctrlplane/auth/utils";
import { and, eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, publicProcedure, router } from "../trpc.js";

export const userRouter = router({
  session: publicProcedure.query(async ({ ctx }) => {
    if (ctx.session == null) return null;
    const user = await ctx.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, ctx.session.user.id))
      .then(takeFirst);

    const workspaces = await ctx.db
      .select()
      .from(schema.workspace)
      .innerJoin(
        schema.entityRole,
        eq(schema.workspace.id, schema.entityRole.scopeId),
      )
      .where(eq(schema.entityRole.entityId, user.id))
      .then((rows) => rows.map((r) => r.workspace));

    return { ...user, workspaces };
  }),

  apiKey: router({
    list: protectedProcedure.query(({ ctx }) =>
      ctx.db
        .select()
        .from(schema.userApiKey)
        .where(eq(schema.userApiKey.userId, ctx.session.user.id))
        .then((rows) => rows.map((row) => _.omit(row, "keyHash"))),
    ),

    create: protectedProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { prefix, apiKey: key, secret } = generateApiKey();

        const apiKey = await ctx.db
          .insert(schema.userApiKey)
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

    revoke: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) =>
        ctx.db
          .delete(schema.userApiKey)
          .where(
            and(
              eq(schema.userApiKey.id, input),
              eq(schema.userApiKey.userId, ctx.session.user.id),
            ),
          )
          .returning()
          .then(takeFirst),
      ),
  }),
});
