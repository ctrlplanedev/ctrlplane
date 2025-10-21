import _ from "lodash-es";
import { z } from "zod";

import { and, count, desc, eq, isNotNull, isNull, sql } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const resourceDistributionRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceProviderGet)
          .on({ type: "workspace", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const resourcesByVersion = await ctx.db
        .select({
          total: count(),
          version: SCHEMA.resource.version,
          kinds: sql<
            Array<string>
          >`json_agg(DISTINCT ${SCHEMA.resource.kind})`.as("kinds"),
        })
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.workspaceId, input),
            isNotNull(SCHEMA.resource.providerId),
            isNull(SCHEMA.resource.deletedAt),
          ),
        )
        .groupBy(SCHEMA.resource.version)
        .orderBy(desc(count()));

      const totalResources = _.sumBy(resourcesByVersion, (r) => r.total);
      const { length: uniqueApiVersions } = resourcesByVersion;
      const averageResourcesPerVersion =
        uniqueApiVersions > 0 ? totalResources / uniqueApiVersions : 0;
      const mostCommonVersion =
        resourcesByVersion[0]?.version ?? "no api versions";

      const versionDistributions = resourcesByVersion.map((r) => ({
        ...r,
        percentage: totalResources > 0 ? (r.total / totalResources) * 100 : 0,
      }));

      return {
        totalResources,
        uniqueApiVersions,
        averageResourcesPerVersion,
        mostCommonVersion,
        versionDistributions,
      };
    }),
});
