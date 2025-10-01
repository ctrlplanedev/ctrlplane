import type * as schema from "@ctrlplane/db/schema";

import type {
  Deployment,
  Environment,
  Resource,
} from "./gen/release_targets_pb";

export const toDeployment = (deployment: schema.Deployment): Deployment => {
  return {
    $typeName: "workspace.Deployment",
    ...deployment,
    jobAgentId: deployment.jobAgentId ?? undefined,
    resourceSelector: deployment.resourceSelector ?? undefined,
  };
};

export const toResource = (
  resource: schema.Resource & { metadata: Record<string, string> },
): Resource => {
  return {
    $typeName: "workspace.Resource",
    ...resource,
    createdAt: resource.createdAt.toISOString(),
    workspaceId: resource.workspaceId,
    updatedAt: resource.updatedAt?.toISOString(),
    deletedAt: resource.deletedAt?.toISOString(),
    lockedAt: resource.lockedAt?.toISOString(),
    providerId: resource.providerId ?? undefined,
  };
};

export const toEnvironment = (environment: schema.Environment): Environment => {
  return {
    $typeName: "workspace.Environment",
    ...environment,
    description: environment.description ?? "",
    resourceSelector: environment.resourceSelector ?? undefined,
    createdAt: environment.createdAt.toISOString(),
  };
};
