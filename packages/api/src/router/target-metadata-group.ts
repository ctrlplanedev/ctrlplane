import { z } from "zod";

import {
  and,
  asc,
  eq,
  inArray,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  target,
  targetMetadata,
  targetMetadataGroup,
  workspace,
} from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const targetMetadataGroupRouter = createTRPCRouter({
  groups: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) => {
      return ctx.db
        .select({
          targets: sql<number>`count(distinct ${target.id})`.mapWith(Number),
          targetMetadataGroup,
        })
        .from(targetMetadataGroup)
        .innerJoin(workspace, eq(targetMetadataGroup.workspaceId, workspace.id))
        .leftJoin(target, eq(target.workspaceId, workspace.id))
        .leftJoin(targetMetadata, eq(targetMetadata.targetId, target.id))
        .where(
          and(
            eq(workspace.id, input),
            sql`"target_metadata"."key" = ANY (${targetMetadataGroup.keys})`,
          ),
        )
        .groupBy(targetMetadataGroup.id)
        .orderBy(asc(targetMetadataGroup.name));
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetGet)
          .on({ type: "targetMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      try {
        const group = await ctx.db
          .select()
          .from(targetMetadataGroup)
          .where(eq(targetMetadataGroup.id, input))
          .then(takeFirstOrNull);

        if (group == null) throw new Error("Group not found");

        const targetMetadataAgg = ctx.db
          .select({
            id: target.id,
            metadata: sql<Record<string, string>>`jsonb_object_agg(
                      ${targetMetadata.key},
                      ${targetMetadata.value}
                    )`.as("metadata"),
          })
          .from(target)
          .leftJoin(
            targetMetadata,
            and(
              eq(target.id, targetMetadata.targetId),
              inArray(targetMetadata.key, group.keys),
            ),
          )
          .where(eq(target.workspaceId, group.workspaceId))
          .groupBy(target.id)
          .as("target_metadata_agg");

        const groups = await ctx.db
          .with(targetMetadataAgg)
          .select({
            metadata: targetMetadataAgg.metadata,
            targets: sql<number>`COUNT(*)`.as("targets"),
          })
          .from(targetMetadataAgg)
          .groupBy(targetMetadataAgg.metadata);

        return {
          ...group,
          groups,
        };
      } catch (error) {
        logger.error(`>>> Error fetching target metadata: ${String(error)}`);
        throw error;
      }
    }),

  upsert: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        data: z.object({
          id: z.string().optional(),
          name: z.string(),
          keys: z.array(z.string()),
          description: z.string(),
        }),
      }),
    )
    .mutation(({ ctx, input }) => {
      ctx.db
        .insert(targetMetadataGroup)
        .values({
          ...input.data,
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          target: targetMetadataGroup.id,
          set: {
            ...input.data,
          },
        })
        .returning()
        .then(takeFirst);
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetDelete)
          .on({ type: "targetMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(targetMetadataGroup)
        .where(eq(targetMetadataGroup.id, input)),
    ),
});
