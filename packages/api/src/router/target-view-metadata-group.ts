import _ from "lodash";
import { z } from "zod";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createTargetViewMetadataGroup,
  target,
  targetMetadata,
  targetView,
  targetViewMetadataGroup,
  targetViewMetadataGroupKey,
  updateTargetViewMetadataGroup,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const targetViewMetadataGroupRouter = createTRPCRouter({
  groups: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewMetadataGroupList)
          .on({ type: "targetView", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db
        .select({
          group: targetViewMetadataGroup,
          keys: sql<string[]>`array_agg(${targetViewMetadataGroupKey.key})`.as(
            "keys",
          ),
          targets: count(target.id).as("targets"),
        })
        .from(targetViewMetadataGroup)
        .leftJoin(
          targetViewMetadataGroupKey,
          eq(targetViewMetadataGroup.id, targetViewMetadataGroupKey.groupId),
        )
        .leftJoin(targetView, eq(targetViewMetadataGroup.viewId, targetView.id))
        .leftJoin(target, eq(targetView.workspaceId, target.workspaceId))
        .leftJoin(
          targetMetadata,
          and(
            eq(target.id, targetMetadata.targetId),
            inArray(
              targetMetadata.key,
              sql`array_agg(${targetViewMetadataGroupKey.key})`,
            ),
          ),
        )
        .where(eq(targetViewMetadataGroup.viewId, input))
        .groupBy(targetViewMetadataGroup.id)
        .orderBy(asc(targetViewMetadataGroup.name));

      return groups;
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewMetadataGroupGet)
          .on({ type: "targetMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const group = await ctx.db
        .select({
          group: targetViewMetadataGroup,
          keys: sql<string[]>`array_agg(${targetViewMetadataGroupKey.key})`.as(
            "keys",
          ),
        })
        .from(targetViewMetadataGroup)
        .leftJoin(
          targetViewMetadataGroupKey,
          eq(targetViewMetadataGroup.id, targetViewMetadataGroupKey.groupId),
        )
        .where(eq(targetViewMetadataGroup.id, input))
        .groupBy(targetViewMetadataGroup.id)
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
        .innerJoin(targetView, eq(target.workspaceId, targetView.workspaceId))
        .innerJoin(
          targetMetadata,
          and(
            eq(target.id, targetMetadata.targetId),
            inArray(targetMetadata.key, group.keys),
          ),
        )
        .where(eq(targetView.id, group.group.viewId))
        .groupBy(target.id)
        .having(
          sql<number>`COUNT(DISTINCT ${targetMetadata.key}) = ${group.keys.length}`,
        )
        .as("target_metadata_agg");

      const combinations = await ctx.db
        .with(targetMetadataAgg)
        .select({
          metadata: targetMetadataAgg.metadata,
          targets: sql<number>`COUNT(*)`.as("targets"),
        })
        .from(targetMetadataAgg)
        .groupBy(targetMetadataAgg.metadata);

      return {
        ...group.group,
        keys: group.keys,
        combinations,
      };
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewMetadataGroupCreate)
          .on({ type: "targetView", id: input.viewId }),
    })
    .input(
      createTargetViewMetadataGroup.extend({
        keys: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [group] = await tx
          .insert(targetViewMetadataGroup)
          .values(createTargetViewMetadataGroup.parse(input))
          .returning();

        // Check if group is defined before proceeding
        if (!group) throw new Error("Group creation failed");

        await tx.insert(targetViewMetadataGroupKey).values(
          input.keys.map((key) => ({
            groupId: group.id,
            key,
          })),
        );

        return group;
      });
    }),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewMetadataGroupUpdate)
          .on({ type: "targetView", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTargetViewMetadataGroup.extend({
          keys: z.array(z.string()).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        if (input.data.name || input.data.viewId) {
          await tx
            .update(targetViewMetadataGroup)
            .set(updateTargetViewMetadataGroup.parse(input.data))
            .where(eq(targetViewMetadataGroup.id, input.id));
        }

        if (input.data.keys) {
          await tx
            .delete(targetViewMetadataGroupKey)
            .where(eq(targetViewMetadataGroupKey.groupId, input.id));

          await tx.insert(targetViewMetadataGroupKey).values(
            input.data.keys.map((key) => ({
              groupId: input.id,
              key,
            })),
          );
        }

        return tx
          .select()
          .from(targetViewMetadataGroup)
          .where(eq(targetViewMetadataGroup.id, input.id))
          .then(takeFirst);
      });
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewMetadataGroupDelete)
          .on({ type: "targetMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(targetViewMetadataGroup)
        .where(eq(targetViewMetadataGroup.id, input)),
    ),
});
