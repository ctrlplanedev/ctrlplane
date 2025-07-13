import { z } from "zod";

import { and, count, eq, isNull, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const resourceViews = createTRPCRouter({
  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(schema.createResourceView)
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .insert(schema.resourceView)
        .values(input)
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewUpdate)
          .on({ type: "resourceView", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: schema.updateResourceView }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(schema.resourceView)
        .set(input.data)
        .where(eq(schema.resourceView.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewDelete)
          .on({ type: "resourceView", id: input }),
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(schema.resourceView)
        .where(eq(schema.resourceView.id, input)),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewGet)
          .on({ type: "resourceView", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(schema.resourceView)
        .where(eq(schema.resourceView.id, input))
        .then(takeFirst),
    ),

  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceViewList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const views = await ctx.db
        .select()
        .from(schema.resourceView)
        .orderBy(schema.resourceView.name)
        .where(eq(schema.resourceView.workspaceId, input));

      const isNotDeleted = isNull(schema.resource.deletedAt);

      return Promise.all(
        views.map(async (view) => {
          const total = await ctx.db
            .select({ count: count() })
            .from(schema.resource)
            .where(
              and(
                schema.resourceMatchesMetadata(ctx.db, view.filter),
                isNotDeleted,
              ),
            )
            .then(takeFirst)
            .then((t) => t.count);

          return { ...view, total };
        }),
      );
    }),
});
