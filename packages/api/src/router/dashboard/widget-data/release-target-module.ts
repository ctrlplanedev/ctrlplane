import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  and,
  desc,
  eq,
  ilike,
  or,
  selector,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";

const getReleaseTargetInfo = async (db: Tx, releaseTargetId: string) =>
  db
    .selectDistinctOn([schema.releaseTarget.id])
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(schema.system, eq(schema.deployment.systemId, schema.system.id))
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .leftJoin(
      schema.versionRelease,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .leftJoin(
      schema.deploymentVersion,
      eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
    )
    .leftJoin(
      schema.release,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .leftJoin(
      schema.releaseJob,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .leftJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
    .orderBy(schema.releaseTarget.id, desc(schema.job.createdAt))
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst);

const getJobWithLinks = async (db: Tx, job: schema.Job) => {
  const jobLinksMetadata = await db
    .select()
    .from(schema.jobMetadata)
    .where(
      and(
        eq(schema.jobMetadata.jobId, job.id),
        eq(schema.jobMetadata.key, ReservedMetadataKey.Links),
      ),
    )
    .then(takeFirstOrNull);

  const linksRaw = jobLinksMetadata?.value ?? "{}";
  const links = JSON.parse(linksRaw) as Record<string, string>;
  return { ...job, links };
};

type DeploymentVersionWithJob = schema.DeploymentVersion & {
  job: schema.Job & { links: Record<string, string> };
};

type ReleaseTargetModuleInfo = schema.ReleaseTarget & {
  resource: schema.Resource;
  deployment: schema.Deployment & { system: schema.System };
  environment: schema.Environment;
  deploymentVersion: DeploymentVersionWithJob | null;
};

const releaseTargetModuleSummary = protectedProcedure
  .input(z.string().uuid())
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: input,
      }),
  })
  .query(async ({ ctx, input }): Promise<ReleaseTargetModuleInfo> => {
    const releaseTargetResult = await getReleaseTargetInfo(ctx.db, input);

    const {
      release_target,
      resource,
      deployment,
      system,
      environment,
      deployment_version,
      job,
    } = releaseTargetResult;

    const releaseTargetBase = {
      ...release_target,
      resource,
      deployment: { ...deployment, system },
      environment,
    };

    if (deployment_version == null || job == null)
      return {
        ...releaseTargetBase,
        deploymentVersion: null,
      };

    const jobWithLinks = await getJobWithLinks(ctx.db, job);
    const deploymentVersion = { ...deployment_version, job: jobWithLinks };
    return { ...releaseTargetBase, deploymentVersion };
  });

const getVersionSelectorSql = async (db: Tx, releaseTargetId: string) => {
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
  db: Tx,
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
    db,
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

const getReleaseTarget = async (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirst);

const getVersionsComparator =
  (releaseTarget: schema.ReleaseTarget) =>
  (a: schema.DeploymentVersion, b: schema.DeploymentVersion) => {
    if (releaseTarget.desiredVersionId === a.id) return -1;
    if (releaseTarget.desiredVersionId === b.id) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  };

const deployableVersions = protectedProcedure
  .input(
    z.object({
      releaseTargetId: z.string().uuid(),
      query: z.string().optional(),
      limit: z.number().default(50),
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
    const releaseTarget = await getReleaseTarget(ctx.db, releaseTargetId);
    const matchesSqlChecks = await getVersionSqlChecks(
      ctx.db,
      releaseTarget,
      query,
    );
    const deploymentVersions = await ctx.db
      .select()
      .from(schema.deploymentVersion)
      .where(matchesSqlChecks)
      .limit(limit)
      .offset(offset);

    return deploymentVersions.sort(getVersionsComparator(releaseTarget));
  });

export const releaseTargetModule = createTRPCRouter({
  summary: releaseTargetModuleSummary,
  deployableVersions,
});
