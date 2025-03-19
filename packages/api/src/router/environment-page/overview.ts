import type { Tx } from "@ctrlplane/db";
import type { JobStatusType } from "@ctrlplane/validators/jobs";
import _ from "lodash";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const failureStatuses: JobStatusType[] = [
  JobStatus.Failure,
  JobStatus.InvalidIntegration,
  JobStatus.InvalidJobAgent,
  JobStatus.ExternalRunNotFound,
];

const pendingStatuses: JobStatusType[] = [
  JobStatus.Pending,
  JobStatus.ActionRequired,
];

const deployedStatuses = [
  ...failureStatuses,
  ...pendingStatuses,
  JobStatus.Successful,
  JobStatus.InProgress,
];

const getDeploymentStats = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
  resourceIds: string[],
) => {
  const deploymentResourceIds = await db
    .select({ id: SCHEMA.resource.id })
    .from(SCHEMA.resource)
    .where(
      and(
        inArray(SCHEMA.resource.id, resourceIds),
        SCHEMA.resourceMatchesMetadata(db, deployment.resourceFilter),
      ),
    )
    .then((resources) => resources.map((r) => r.id));
  const { length: numResources } = deploymentResourceIds;

  const latestJobsPerResourceAndDeploymentSubquery = db
    .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId], {
      resourceId: SCHEMA.releaseJobTrigger.resourceId,
      jobId: SCHEMA.job.id,
      status: SCHEMA.job.status,
    })
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .innerJoin(
      SCHEMA.resource,
      eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
    )
    .innerJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .where(
      and(
        inArray(SCHEMA.releaseJobTrigger.resourceId, deploymentResourceIds),
        eq(SCHEMA.releaseJobTrigger.environmentId, environment.id),
        eq(SCHEMA.deploymentVersion.deploymentId, deployment.id),
        inArray(SCHEMA.job.status, deployedStatuses),
        SCHEMA.resourceMatchesMetadata(db, deployment.resourceFilter),
      ),
    )
    .orderBy(
      SCHEMA.releaseJobTrigger.resourceId,
      desc(SCHEMA.job.createdAt),
      desc(SCHEMA.deploymentVersion.createdAt),
    )
    .as("latest_jobs");

  const statsByJobStatus = await db
    .select({
      successful: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} = ${JobStatus.Successful} THEN 1 ELSE NULL END`,
      ),
      inProgress: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} = ${JobStatus.InProgress} THEN 1 ELSE NULL END`,
      ),
      pending: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} IN (${sql.raw(pendingStatuses.map((s) => `'${s}'`).join(", "))}) THEN 1 ELSE NULL END`,
      ),
      failed: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} IN (${sql.raw(failureStatuses.map((s) => `'${s}'`).join(", "))}) THEN 1 ELSE NULL END`,
      ),
    })
    .from(latestJobsPerResourceAndDeploymentSubquery);

  const total = numResources;
  const successful = _.sumBy(statsByJobStatus, "successful");
  const inProgress = _.sumBy(statsByJobStatus, "inProgress");
  const pending = _.sumBy(statsByJobStatus, "pending");
  const failed = _.sumBy(statsByJobStatus, "failed");
  const notDeployed = numResources - successful - failed - inProgress - pending;

  return {
    deploymentId: deployment.id,
    total,
    successful,
    inProgress,
    pending,
    failed,
    notDeployed,
  };
};

export const overviewRouter = createTRPCRouter({
  latestDeploymentStats: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, input))
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
          total: _.sumBy(deploymentStats, "total"),
          successful: _.sumBy(deploymentStats, "successful"),
          failed: _.sumBy(deploymentStats, "failed"),
          inProgress: _.sumBy(deploymentStats, "inProgress"),
          pending: _.sumBy(deploymentStats, "pending"),
          notDeployed: _.sumBy(deploymentStats, "notDeployed"),
        },
        resources: resources.length,
      };
    }),
});
