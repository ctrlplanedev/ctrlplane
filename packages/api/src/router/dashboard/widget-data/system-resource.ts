import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { and, desc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure } from "../../../trpc";

type Version = schema.DeploymentVersion & {
  job: schema.Job & { metadata: Record<string, string> };
};

type ReleaseTarget = schema.ReleaseTarget & {
  version: Version | null;
};

type Deployment = schema.Deployment & {
  releaseTarget: ReleaseTarget | null;
};

const getSystem = async (db: Tx, systemId: string) =>
  db
    .select()
    .from(schema.system)
    .where(eq(schema.system.id, systemId))
    .then(takeFirst);

const getResource = async (db: Tx, resourceId: string) =>
  db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.id, resourceId))
    .then(takeFirst);

const getDeployments = async (db: Tx, systemId: string, resourceId: string) =>
  db
    .select()
    .from(schema.deployment)
    .leftJoin(
      schema.releaseTarget,
      and(
        eq(schema.releaseTarget.resourceId, resourceId),
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      ),
    )
    .where(eq(schema.deployment.systemId, systemId))
    .orderBy(schema.deployment.name);

const getLatestJob = async (db: Tx, deploymentId: string) =>
  db
    .select()
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.deploymentVersion,
      eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
    )
    .orderBy(desc(schema.job.createdAt))
    .where(eq(schema.deploymentVersion.deploymentId, deploymentId))
    .limit(1)
    .then(takeFirstOrNull);

const getJobMetadata = async (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.jobMetadata)
    .where(eq(schema.jobMetadata.jobId, jobId))
    .then((rows) =>
      Object.fromEntries(rows.map((row) => [row.key, row.value])),
    );

export const systemResourceDeployments = protectedProcedure
  .input(
    z.object({
      systemId: z.string().uuid(),
      resourceId: z.string().uuid(),
    }),
  )
  .query(
    async ({
      ctx,
      input,
    }): Promise<
      schema.System & { resource: schema.Resource; deployments: Deployment[] }
    > => {
      const { systemId, resourceId } = input;

      const system = await getSystem(ctx.db, systemId);
      const resource = await getResource(ctx.db, resourceId);
      const deployments = await getDeployments(ctx.db, systemId, resourceId);

      const deploymentsWithJobsPromises = deployments.map(
        async ({ deployment, release_target }) => {
          if (release_target == null)
            return { ...deployment, releaseTarget: null };

          const latestJob = await getLatestJob(ctx.db, deployment.id);

          if (latestJob == null)
            return {
              ...deployment,
              releaseTarget: { ...release_target, version: null },
            };

          const metadata = await getJobMetadata(ctx.db, latestJob.job.id);

          return {
            ...deployment,
            releaseTarget: {
              ...release_target,
              version: {
                ...latestJob.deployment_version,
                job: { ...latestJob.job, metadata },
              },
            },
          };
        },
      );

      return {
        ...system,
        resource,
        deployments: await Promise.all(deploymentsWithJobsPromises),
      };
    },
  );
