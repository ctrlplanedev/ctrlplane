import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, asc, eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const groupingSchema = z.array(
  z.object({ name: z.string().min(1), property: z.string().min(1) }),
);

export const resourceAggregatesRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceAggregateList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const aggregates = await ctx.db
        .select()
        .from(schema.resourceAggregate)
        .where(eq(schema.resourceAggregate.workspaceId, input.workspaceId))
        .orderBy(
          asc(schema.resourceAggregate.name),
          asc(schema.resourceAggregate.id),
        );

      return aggregates;
    }),

  get: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceAggregateGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.uuid(), id: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const [aggregate] = await ctx.db
        .select()
        .from(schema.resourceAggregate)
        .where(
          and(
            eq(schema.resourceAggregate.id, input.id),
            eq(schema.resourceAggregate.workspaceId, input.workspaceId),
          ),
        );

      if (aggregate == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource aggregate not found",
        });

      return aggregate;
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceAggregateCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        filter: z.string().optional(),
        groupBy: groupingSchema.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [aggregate] = await ctx.db
        .insert(schema.resourceAggregate)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          filter: input.filter,
          groupBy: input.groupBy,
          createdBy: ctx.session.user.id,
        })
        .returning();

      return aggregate;
    }),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceAggregateUpdate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.uuid(),
        id: z.uuid(),
        name: z.string().min(1).optional(),
        description: z.string().nullish(),
        filter: z.string().optional(),
        groupBy: groupingSchema.nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, workspaceId, ...values } = input;

      const [aggregate] = await ctx.db
        .update(schema.resourceAggregate)
        .set(values)
        .where(
          and(
            eq(schema.resourceAggregate.id, id),
            eq(schema.resourceAggregate.workspaceId, workspaceId),
          ),
        )
        .returning();

      if (aggregate == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource aggregate not found",
        });

      return aggregate;
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceAggregateDelete)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.uuid(), id: z.uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [aggregate] = await ctx.db
        .delete(schema.resourceAggregate)
        .where(
          and(
            eq(schema.resourceAggregate.id, input.id),
            eq(schema.resourceAggregate.workspaceId, input.workspaceId),
          ),
        )
        .returning();

      if (aggregate == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource aggregate not found",
        });

      return aggregate;
    }),

  evaluate: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), id: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const aggregate = await ctx.db
        .select()
        .from(schema.resourceAggregate)
        .where(eq(schema.resourceAggregate.id, input.id))
        .then(takeFirst);

      if (aggregate.groupBy == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aggregate has no groupBy. Call resource query instead.",
        });
      }

      const result = await getClientFor().POST(
        "/v1/workspaces/{workspaceId}/resources/aggregates",
        {
          body: {
            filter: aggregate.filter,
            groupBy: aggregate.groupBy,
          },
          params: {
            path: {
              workspaceId: input.workspaceId.toString(),
            },
          },
        },
      );

      return result;
    }),
});
