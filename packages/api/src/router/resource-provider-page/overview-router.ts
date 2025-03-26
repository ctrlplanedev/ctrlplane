import _ from "lodash";
import { z } from "zod";

import { and, count, eq, isNotNull, isNull, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const overviewRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceProviderGet)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const providersPromise = ctx.db
        .select({
          total: count(),
          google: count(SCHEMA.resourceProviderGoogle.id),
          aws: count(SCHEMA.resourceProviderAws.id),
          azure: count(SCHEMA.resourceProviderAzure.id),
        })
        .from(SCHEMA.resourceProvider)
        .leftJoin(
          SCHEMA.resourceProviderGoogle,
          eq(
            SCHEMA.resourceProvider.id,
            SCHEMA.resourceProviderGoogle.resourceProviderId,
          ),
        )
        .leftJoin(
          SCHEMA.resourceProviderAws,
          eq(
            SCHEMA.resourceProvider.id,
            SCHEMA.resourceProviderAws.resourceProviderId,
          ),
        )
        .leftJoin(
          SCHEMA.resourceProviderAzure,
          eq(
            SCHEMA.resourceProvider.id,
            SCHEMA.resourceProviderAzure.resourceProviderId,
          ),
        )
        .where(eq(SCHEMA.resourceProvider.workspaceId, input))
        .then(takeFirst);

      const resourcesPromise = ctx.db
        .select({
          count: count(),
          kind: SCHEMA.resource.kind,
          version: SCHEMA.resource.version,
        })
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.workspaceId, input),
            isNotNull(SCHEMA.resource.providerId),
            isNull(SCHEMA.resource.deletedAt),
          ),
        )
        .groupBy(SCHEMA.resource.kind, SCHEMA.resource.version);

      const [providers, resources] = await Promise.all([
        providersPromise,
        resourcesPromise,
      ]);

      const totalResources = _.sumBy(resources, (r) => r.count);

      const popularKinds = resources
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      return {
        providers,
        resources: { total: totalResources, popularKinds },
      };
    }),
});
