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
  createResourceMetadataGroup,
  resource,
  resourceMetadata,
  resourceMetadataGroup,
  updateResourceMetadataGroup,
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
        .select({ targetId: resource.id })
        .from(resource)
        .leftJoin(
          resourceMetadata,
          eq(resourceMetadata.resourceId, resource.id),
        )
        .where(
          and(
            eq(resource.workspaceId, resourceMetadataGroup.workspaceId),
            sql`${resourceMetadata.key} = ANY(${resourceMetadataGroup.keys})`,
          ),
        )
        .groupBy(resource.id)
        .having(
          sql`COUNT(DISTINCT ${resourceMetadata.key}) = ARRAY_LENGTH(${resourceMetadataGroup.keys}, 1)`,
        );

      const nonNullGroups = await ctx.db
        .select({
          targets: sql<number>`
            COALESCE((
              SELECT ${count()}
              FROM (${matchingTargetsQuery}) AS matching_targets
            ), 0)`.mapWith(Number),
          resourceMetadataGroup,
        })
        .from(resourceMetadataGroup)
        .where(
          and(
            eq(resourceMetadataGroup.workspaceId, input),
            eq(resourceMetadataGroup.includeNullCombinations, false),
          ),
        )
        .orderBy(asc(resourceMetadataGroup.name));

      const allTargetCount = await ctx.db
        .select({
          targets: count(),
        })
        .from(resource)
        .where(eq(resource.workspaceId, input))
        .then(takeFirst)
        .then((row) => row.targets);

      const nullCombinations = await ctx.db
        .select()
        .from(resourceMetadataGroup)
        .where(
          and(
            eq(resourceMetadataGroup.workspaceId, input),
            eq(resourceMetadataGroup.includeNullCombinations, true),
          ),
        )
        .orderBy(asc(resourceMetadataGroup.name))
        .then((rows) =>
          rows.map((row) => ({
            targets: allTargetCount,
            resourceMetadataGroup: row,
          })),
        );

      const combinedGroups = [...nonNullGroups, ...nullCombinations];

      const sortedGroups = combinedGroups
        .sort((a, b) =>
          a.resourceMetadataGroup.name.localeCompare(
            b.resourceMetadataGroup.name,
          ),
        )
        .map((group) => ({
          targets: group.targets,
          targetMetadataGroup: group.resourceMetadataGroup,
        }));

      return sortedGroups;
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupGet)
          .on({ type: "resourceMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const group = await ctx.db
        .select()
        .from(resourceMetadataGroup)
        .where(eq(resourceMetadataGroup.id, input))
        .then(takeFirstOrNull);

      if (group == null) throw new Error("Group not found");

      const resourceMetadataAggBase = ctx.db
        .select({
          id: resource.id,
          metadata: sql<Record<string, string>>`jsonb_object_agg(
            ${resourceMetadata.key},
            ${resourceMetadata.value}
          )`.as("metadata"),
        })
        .from(resource)
        .innerJoin(
          resourceMetadata,
          and(
            eq(resource.id, resourceMetadata.resourceId),
            inArray(resourceMetadata.key, group.keys),
          ),
        )
        .where(eq(resource.workspaceId, group.workspaceId))
        .groupBy(resource.id);

      const resourceMetadataAgg = group.includeNullCombinations
        ? resourceMetadataAggBase.as("resource_metadata_agg")
        : resourceMetadataAggBase
            .having(
              sql<number>`COUNT(DISTINCT ${resourceMetadata.key}) = ${group.keys.length}`,
            )
            .as("resource_metadata_agg");

      const combinations = await ctx.db
        .with(resourceMetadataAgg)
        .select({
          metadata: resourceMetadataAgg.metadata,
          targets: sql<number>`COUNT(*)`.as("targets"),
        })
        .from(resourceMetadataAgg)
        .groupBy(resourceMetadataAgg.metadata);

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
    .input(createResourceMetadataGroup)
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(resourceMetadataGroup)
        .values(input)
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupUpdate)
          .on({ type: "resourceMetadataGroup", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateResourceMetadataGroup,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(resourceMetadataGroup)
        .set(input.data)
        .where(eq(resourceMetadataGroup.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetMetadataGroupDelete)
          .on({ type: "resourceMetadataGroup", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(resourceMetadataGroup)
        .where(eq(resourceMetadataGroup.id, input)),
    ),
});
