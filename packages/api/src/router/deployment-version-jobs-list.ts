import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { protectedProcedure } from "../trpc";
import { getWorkspaceEngineClient } from "../workspace-engine-client";

const getWorkspaceId = async (tx: Tx, versionId: string) =>
  tx
    .select()
    .from(SCHEMA.deploymentVersion)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
    )
    .innerJoin(SCHEMA.system, eq(SCHEMA.deployment.systemId, SCHEMA.system.id))
    .where(eq(SCHEMA.deploymentVersion.id, versionId))
    .then(takeFirst)
    .then(({ system }) => system.workspaceId);

type Job = {
  createdAt: Date;
  externalId: string | null;
  id: string;
  links: Record<string, string>;
  status: SCHEMA.JobStatus;
};

type DeploymentVersionJobsListResponse = {
  environment: SCHEMA.Environment;
  releaseTargets: {
    deployment: SCHEMA.Deployment;
    environment: SCHEMA.Environment;
    resource: SCHEMA.Resource;
    id: string;
    resourceId: string;
    environmentId: string;
    deploymentId: string;
    desiredReleaseId: string | null;
    desiredVersionId: string | null;
    jobs: Job[];
  }[];
}[];

const convertOapiSelectorToResourceCondition = (
  selector?: WorkspaceEngine["schemas"]["Selector"],
): ResourceCondition | null => {
  if (selector == null) return null;
  if ("json" in selector) return selector.json as ResourceCondition;
  return null;
};

const getJobLinks = (metadata: Record<string, string>) => {
  const linksStr = metadata[ReservedMetadataKey.Links] ?? "{}";

  try {
    const links = JSON.parse(linksStr) as Record<string, string>;
    return links;
  } catch (error) {
    logger.error("Error parsing job links", {
      error,
      metadata,
    });
    return {};
  }
};

const convertOapiEnvironmentToSchema = (
  environment: WorkspaceEngine["schemas"]["Environment"],
): SCHEMA.Environment => ({
  ...environment,
  directory: "",
  description: environment.description ?? null,
  createdAt: new Date(environment.createdAt),
  resourceSelector: convertOapiSelectorToResourceCondition(
    environment.resourceSelector,
  ),
});

const convertOapiDeploymentToSchema = (
  deployment: WorkspaceEngine["schemas"]["Deployment"],
): SCHEMA.Deployment => ({
  ...deployment,
  resourceSelector: convertOapiSelectorToResourceCondition(
    deployment.resourceSelector,
  ),
  description: deployment.description ?? "",
  jobAgentId: deployment.jobAgentId ?? null,
  retryCount: 0,
  timeout: null,
});

const convertOapiResourceToSchema = (
  resource: WorkspaceEngine["schemas"]["Resource"],
): SCHEMA.Resource => ({
  ...resource,
  providerId: resource.providerId ?? null,
  createdAt: new Date(resource.createdAt),
  deletedAt: resource.deletedAt ? new Date(resource.deletedAt) : null,
  lockedAt: resource.lockedAt ? new Date(resource.lockedAt) : null,
  updatedAt: resource.updatedAt ? new Date(resource.updatedAt) : null,
});

const convertOapiJobStatusToSchema = (
  status: WorkspaceEngine["schemas"]["JobStatus"],
): SCHEMA.JobStatus => {
  switch (status) {
    case "pending":
      return "pending";
    case "inProgress":
      return "in_progress";
    case "successful":
      return "successful";
    case "cancelled":
      return "cancelled";
    case "skipped":
      return "skipped";
    case "failure":
      return "failure";
    case "actionRequired":
      return "action_required";
    case "invalidJobAgent":
      return "invalid_job_agent";
    case "invalidIntegration":
      return "invalid_integration";
    case "externalRunNotFound":
      return "external_run_not_found";
  }
};

export const deploymentVersionJobsList = protectedProcedure
  .input(
    z.object({
      versionId: z.string().uuid(),
      search: z.string().default(""),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.DeploymentVersionGet).on({
        type: "deploymentVersion",
        id: input.versionId,
      }),
  })
  .query<DeploymentVersionJobsListResponse>(
    async ({ ctx, input: { versionId } }) => {
      const workspaceId = await getWorkspaceId(ctx.db, versionId);
      const client = getWorkspaceEngineClient();
      const resp = await client.GET(
        "/v1/workspaces/{workspaceId}/deployment-versions/{versionId}/jobs-list",
        {
          params: {
            path: {
              workspaceId,
              versionId,
            },
          },
        },
      );
      return (resp.data ?? []).map((env) => ({
        environment: convertOapiEnvironmentToSchema(env.environment),
        releaseTargets: env.releaseTargets.map((releaseTarget) => ({
          deployment: convertOapiDeploymentToSchema(releaseTarget.deployment),
          environment: convertOapiEnvironmentToSchema(
            releaseTarget.environment,
          ),
          resource: convertOapiResourceToSchema(releaseTarget.resource),
          id: releaseTarget.id,
          resourceId: releaseTarget.resourceId,
          environmentId: releaseTarget.environmentId,
          deploymentId: releaseTarget.deploymentId,
          desiredReleaseId: null,
          desiredVersionId: null,
          jobs: releaseTarget.jobs.map((job) => ({
            createdAt: new Date(job.createdAt),
            externalId: job.externalId ?? null,
            id: job.id,
            status: convertOapiJobStatusToSchema(job.status),
            links: getJobLinks(job.metadata),
          })),
        })),
      }));
    },
  );
