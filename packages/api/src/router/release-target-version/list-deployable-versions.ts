import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, desc, eq, ilike, or, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { protectedProcedure } from "../../trpc";
import { getReleaseTarget } from "./utils";

const getVersionSelectorSql = async (releaseTargetId: string) => {
  const policies = await getApplicablePolicies(db, releaseTargetId).then(
    (policies) => policies.sort((a, b) => b.priority - a.priority),
  );

  const deploymentVersionSelector = policies.find(
    (p) => p.deploymentVersionSelector != null,
  )?.deploymentVersionSelector?.deploymentVersionSelector;

  return selector()
    .query()
    .deploymentVersions()
    .where(deploymentVersionSelector)
    .sql();
};

const getVersionSqlChecks = async (
  releaseTarget: schema.ReleaseTarget,
  query?: string,
) => {
  const matchesDeployment = eq(
    schema.deploymentVersion.deploymentId,
    releaseTarget.deploymentId,
  );
  const isReady = eq(
    schema.deploymentVersion.status,
    DeploymentVersionStatus.Ready,
  );
  const matchesPolicyVersionSelector = await getVersionSelectorSql(
    releaseTarget.id,
  );
  const matchesQuery =
    query != null
      ? or(
          ilike(schema.deploymentVersion.name, `%${query}%`),
          ilike(schema.deploymentVersion.tag, `%${query}%`),
        )
      : undefined;

  return and(
    matchesDeployment,
    isReady,
    matchesPolicyVersionSelector,
    matchesQuery,
  );
};

const getJobsForVersion = async (
  releaseTargetId: string,
  versionId: string,
) => {
  const jobRows = await db
    .select()
    .from(schema.job)
    .leftJoin(schema.jobMetadata, eq(schema.jobMetadata.jobId, schema.job.id))
    .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .where(
      and(
        eq(schema.versionRelease.releaseTargetId, releaseTargetId),
        eq(schema.versionRelease.versionId, versionId),
      ),
    )
    .orderBy(desc(schema.job.createdAt));

  return _.chain(jobRows)
    .groupBy((row) => row.job.id)
    .map((groupedRows) => {
      const { job } = groupedRows[0]!;
      const metadataList = groupedRows
        .map((row) => row.job_metadata)
        .filter(isPresent);
      const linksRaw =
        metadataList.find(
          ({ key }) => key === String(ReservedMetadataKey.Links),
        )?.value ?? "{}";
      const links = JSON.parse(linksRaw) as Record<string, string>;
      return { ...job, links };
    })
    .value();
};

type VersionWithJobs = schema.DeploymentVersion & { jobs: schema.Job[] };

export const listDeployableVersions = protectedProcedure
  .input(
    z.object({
      releaseTargetId: z.string().uuid(),
      query: z.string().optional(),
      limit: z.number().default(500),
      offset: z.number().default(0),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input.releaseTargetId,
      }),
  })
  .query(async ({ ctx, input }) => {
    const { releaseTargetId, query, limit, offset } = input;

    const releaseTarget = await getReleaseTarget(releaseTargetId);
    const matchesSqlChecks = await getVersionSqlChecks(releaseTarget, query);
    const deploymentVersions = await ctx.db
      .select()
      .from(schema.deploymentVersion)
      .where(matchesSqlChecks)
      .limit(limit)
      .offset(offset);

    const versionsWithJobs = await Promise.all(
      deploymentVersions.map(async (dv) => {
        const jobs = await getJobsForVersion(releaseTargetId, dv.id);
        return { ...dv, jobs };
      }),
    );

    const versionsComparator = (a: VersionWithJobs, b: VersionWithJobs) => {
      if (releaseTarget.desiredVersionId === a.id) return -1;
      const aLatestJobDate = a.jobs[0]?.createdAt ?? new Date(0);
      const bLatestJobDate = b.jobs[0]?.createdAt ?? new Date(0);

      if (aLatestJobDate.getTime() !== bLatestJobDate.getTime())
        return bLatestJobDate.getTime() - aLatestJobDate.getTime();

      return b.createdAt.getTime() - a.createdAt.getTime();
    };

    return versionsWithJobs.sort(versionsComparator);
  });
