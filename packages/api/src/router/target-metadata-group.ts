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
  createTargetMetadataGroup,
  target,
  targetMetadata,
  targetMetadataGroup,
  updateTargetMetadataGroup,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const targetMetadataGroupRouter = createTRPCRouter({
  groups: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      /*
      perform two separate queries:

      1. grab all target groups where null combinations are not allowed and add the metadata key count subquery to get the number of targets in that label group
      2. count all the targets in the workspace once, then grab only the metadata groups where null combinations were allowed and add the total target count to the metadata group
      
      then combine the two results and sort them by name
      */
      const matchingTargetsQuery = ctx.db
        .select({ targetId: target.id })
        .from(target)
        .leftJoin(targetMetadata, eq(targetMetadata.targetId, target.id))
        .where(
          and(
            eq(target.workspaceId, targetMetadataGroup.workspaceId),
            sql`${targetMetadata.key} = ANY(${targetMetadataGroup.keys})`,
          ),
        )
        .groupBy(target.id)
        .having(
          sql`COUNT(DISTINCT ${targetMetadata.key}) = ARRAY_LENGTH(${targetMetadataGroup.keys}, 1)`,
        );

      const nonNullGroups = await ctx.db
        .select({
          targets: sql<number>`
            COALESCE((
              SELECT ${count()}
              FROM (${matchingTargetsQuery}) AS matching_targets
            ), 0)`.mapWith(Number),
          targetMetadataGroup,
        })
        .from(targetMetadataGroup)
        .where(
          and(
            eq(targetMetadataGroup.workspaceId, input),
            eq(targetMetadataGroup.includeNullCombinations, false),
          ),
        )
        .orderBy(asc(targetMetadataGroup.name));

      const allTargetCount = await ctx.db
        .select({
          targets: count(),
        })
        .from(target)
        .where(eq(target.workspaceId, input))
        .then(takeFirst)
        .then((row) => row.targets);

      const nullCombinations = await ctx.db
        .select()
        .from(targetMetadataGroup)
        .where(
          and(
            eq(targetMetadataGroup.workspaceId, input),
            eq(targetMetadataGroup.includeNullCombinations, true),
          ),
        )
        .orderBy(asc(targetMetadataGroup.name))
        .then((rows) =>
          rows.map((row) => ({
            targets: allTargetCount,
            targetMetadataGroup: row,
          })),
        );

      const combinedGroups = [...nonNullGroups, ...nullCombinations];

      const sortedGroups = combinedGroups.sort((a, b) =>
        a.targetMetadataGroup.name.localeCompare(b.targetMetadataGroup.name),
      );

      return sortedGroups;
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupGet)
          .on({ type: "targetMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const group = await ctx.db
        .select()
        .from(targetMetadataGroup)
        .where(eq(targetMetadataGroup.id, input))
        .then(takeFirstOrNull);

      if (group == null) throw new Error("Group not found");

      const targetMetadataAggBase = ctx.db
        .select({
          id: target.id,
          metadata: sql<Record<string, string>>`jsonb_object_agg(
                      ${targetMetadata.key},
                      ${targetMetadata.value}
                    )`.as("metadata"),
        })
        .from(target)
        .innerJoin(
          targetMetadata,
          and(
            eq(target.id, targetMetadata.targetId),
            inArray(targetMetadata.key, group.keys),
          ),
        )
        .where(eq(target.workspaceId, group.workspaceId))
        .groupBy(target.id);

      const targetMetadataAgg = group.includeNullCombinations
        ? targetMetadataAggBase.as("target_metadata_agg")
        : targetMetadataAggBase
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

      if (group.includeNullCombinations)
        return {
          ...group,
          combinations: combinations.map((combination) => {
            const combinationKeys = Object.keys(combination.metadata);
            const nullKeys = _.chain(group.keys)
              .difference(combinationKeys)
              .keyBy()
              .mapValues(() => null)
              .value();

            return {
              ...combination,
              metadata: {
                ...combination.metadata,
                ...nullKeys,
              },
            };
          }),
        };

      return {
        ...group,
        combinations,
      };
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createTargetMetadataGroup)
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(targetMetadataGroup)
        .values(input)
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupUpdate)
          .on({ type: "targetMetadataGroup", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTargetMetadataGroup,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(targetMetadataGroup)
        .set(input.data)
        .where(eq(targetMetadataGroup.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupDelete)
          .on({ type: "targetMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(targetMetadataGroup)
        .where(eq(targetMetadataGroup.id, input)),
    ),
});
