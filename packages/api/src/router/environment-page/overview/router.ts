import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, isNull, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";
import { getDeploymentStats } from "./deployment-stats";
import { getDesiredVersion } from "./desired-version";
import { getVersionDistro } from "./version-distro";

export const overviewRouter = createTRPCRouter({
  latestDeploymentStats: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        workspaceId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input.environmentId }),
    })
    .query(async ({ ctx, input }) => {
      const { environmentId, workspaceId } = input;
      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, environmentId))
        .then(takeFirst);

      const deployments = await ctx.db
        .select()
        .from(SCHEMA.deployment)
        .where(eq(SCHEMA.deployment.systemId, environment.systemId));

      if (environment.resourceFilter == null) {
        return {
          deployments: {
            total: 0,
            successful: 0,
            failed: 0,
            inProgress: 0,
            pending: 0,
            notDeployed: 0,
          },
          resources: 0,
        };
      }

      const resources = await ctx.db
        .select({ id: SCHEMA.resource.id })
        .from(SCHEMA.resource)
        .where(
          and(
            isNull(SCHEMA.resource.deletedAt),
            SCHEMA.resourceMatchesMetadata(ctx.db, environment.resourceFilter),
            eq(SCHEMA.resource.workspaceId, workspaceId),
          ),
        );

      const deploymentPromises = deployments.map((deployment) =>
        getDeploymentStats(
          ctx.db,
          environment,
          deployment,
          resources.map((r) => r.id),
        ),
      );
      const deploymentStats = await Promise.all(deploymentPromises);

      return {
        deployments: {
          total: _.sumBy(deploymentStats, (s) => s.total),
          successful: _.sumBy(deploymentStats, (s) => s.successful),
          failed: _.sumBy(deploymentStats, (s) => s.failed),
          inProgress: _.sumBy(deploymentStats, (s) => s.inProgress),
          pending: _.sumBy(deploymentStats, (s) => s.pending),
          notDeployed: _.sumBy(deploymentStats, (s) => s.notDeployed),
        },
        resources: resources.length,
      };
    }),

  telemetry: createTRPCRouter({
    byDeploymentId: protectedProcedure
      .input(
        z.object({
          environmentId: z.string().uuid(),
          deploymentId: z.string().uuid(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.EnvironmentGet)
            .on({ type: "environment", id: input.environmentId }),
      })
      .query(async ({ ctx, input }) => {
        const { environmentId, deploymentId } = input;

        const envPromise = ctx.db
          .select()
          .from(SCHEMA.environment)
          .where(eq(SCHEMA.environment.id, environmentId))
          .then(takeFirst);

        const deploymentPromise = ctx.db
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, deploymentId))
          .then(takeFirst);

        const [environment, deployment] = await Promise.all([
          envPromise,
          deploymentPromise,
        ]);

        if (environment.resourceFilter == null) return null;

        const resourceSelector: ResourceCondition = {
          type: FilterType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [
            environment.resourceFilter,
            deployment.resourceFilter,
          ].filter(isPresent),
        };

        const resourceIds = await ctx.db
          .select({ id: SCHEMA.resource.id })
          .from(SCHEMA.resource)
          .where(
            and(
              SCHEMA.resourceMatchesMetadata(ctx.db, resourceSelector),
              isNull(SCHEMA.resource.deletedAt),
            ),
          )
          .then((rs) => rs.map((r) => r.id));

        const versionDistroPromise = getVersionDistro(
          ctx.db,
          environment,
          deployment,
          resourceIds,
        );

        const desiredVersionPromise = getDesiredVersion(
          ctx.db,
          environment,
          deployment,
          resourceIds,
        );

        const [versionDistro, desiredVersion] = await Promise.all([
          versionDistroPromise,
          desiredVersionPromise,
        ]);

        return {
          resourceCount: resourceIds.length,
          versionDistro,
          desiredVersion,
        };
      }),
  }),
});
