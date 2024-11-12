import type { EntityType, ScopeType } from "@ctrlplane/db/schema";

import { and, eq, inArray, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  deploymentVariable,
  entityRole,
  environment,
  environmentPolicy,
  job,
  jobAgent,
  release,
  releaseChannel,
  releaseJobTrigger,
  role,
  rolePermission,
  runbook,
  runbookJobTrigger,
  system,
  target,
  targetMetadataGroup,
  targetProvider,
  targetView,
  variableSet,
  workspace,
} from "@ctrlplane/db/schema";

/**
 * Returns the first matching scope
 */
const findFirstMatchingScopeWithPermission = async (
  entity: { type: EntityType; id: string },
  scopes: Array<{ type: ScopeType; id: string }>,
  permissions: string[],
) => {
  const scopeIds = scopes.map((scope) => scope.id);
  const results = await db
    .select({
      scopeId: entityRole.scopeId,
      scopeType: entityRole.scopeType,
    })
    .from(entityRole)
    .innerJoin(role, eq(entityRole.roleId, role.id))
    .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .where(
      and(
        eq(entityRole.entityId, entity.id),
        eq(entityRole.entityType, entity.type),
        inArray(rolePermission.permission, permissions),
        inArray(entityRole.scopeId, scopeIds),
      ),
    );

  // Sort the results based on the position of scopeId in scopeIds
  results.sort(
    (a, b) => scopeIds.indexOf(a.scopeId) - scopeIds.indexOf(b.scopeId),
  );

  // Return the first result or null if no results
  return results.length > 0 ? results[0] : null;
};

/**
 * Checks if an entity has a specific permission for a given resource. This
 * function checks permissions across different scope levels, prioritizing
 * readability over abstraction. As the complexity grows, we may consider
 * introducing abstractions to simplify the logic.
 */
export const checkEntityPermissionForResource = async (
  entity: { type: EntityType; id: string },
  resource: { type: ScopeType; id: string },
  permissions: string[],
): Promise<boolean> => {
  const scopes = await fetchScopeHierarchyForResource(resource);
  const role = await findFirstMatchingScopeWithPermission(
    entity,
    scopes,
    permissions,
  );
  return role != null;
};

const getReleaseScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(deployment, eq(deployment.systemId, system.id))
    .innerJoin(release, eq(release.deploymentId, deployment.id))
    .where(eq(release.id, id))
    .then(takeFirst);

  return [
    { type: "release" as const, id: result.release.id },
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getReleaseChannelScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(deployment, eq(deployment.systemId, system.id))
    .innerJoin(releaseChannel, eq(releaseChannel.deploymentId, deployment.id))
    .where(eq(releaseChannel.id, id))
    .then(takeFirst);

  return [
    { type: "releaseChannel" as const, id: result.release_channel.id },
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getEnvironmentScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(environment, eq(environment.systemId, system.id))
    .where(eq(environment.id, id))
    .then(takeFirst);

  return [
    { type: "environment" as const, id: result.environment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getEnvironmentPolicyScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(environmentPolicy, eq(environmentPolicy.systemId, system.id))
    .where(eq(environmentPolicy.id, id))
    .then(takeFirst);

  return [
    { type: "environmentPolicy" as const, id: result.environment_policy.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getVariableSetScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(variableSet, eq(variableSet.systemId, system.id))
    .where(eq(variableSet.id, id))
    .then(takeFirst);

  return [
    { type: "variableSet" as const, id: result.variable_set.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getTargetMetadataGroupScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(
      targetMetadataGroup,
      eq(targetMetadataGroup.workspaceId, workspace.id),
    )
    .where(eq(targetMetadataGroup.id, id))
    .then(takeFirst);

  return [
    {
      type: "resourceMetadataGroup" as const,
      id: result.resource_metadata_group.id,
    },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getTargetScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(target, eq(target.workspaceId, workspace.id))
    .where(eq(target.id, id))
    .then(takeFirst);

  return [
    { type: "resource" as const, id: result.resource.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getTargetProviderScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(targetProvider, eq(targetProvider.workspaceId, workspace.id))
    .where(eq(targetProvider.id, id))
    .then(takeFirst);

  return [
    { type: "resourceProvider" as const, id: result.resource_provider.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getTargetViewScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(targetView, eq(targetView.workspaceId, workspace.id))
    .where(eq(targetView.id, id))
    .then(takeFirst);

  return [
    { type: "resourceView" as const, id: result.resource_view.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getDeploymentScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(deployment, eq(deployment.systemId, system.id))
    .where(eq(deployment.id, id))
    .then(takeFirst);

  return [
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getDeploymentVariableScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(deployment, eq(deployment.systemId, system.id))
    .innerJoin(
      deploymentVariable,
      eq(deploymentVariable.deploymentId, deployment.id),
    )
    .where(eq(deploymentVariable.id, id))
    .then(takeFirst);

  return [
    { type: "deploymentVariable" as const, id: result.deployment_variable.id },
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getRunbookScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(runbook, eq(runbook.systemId, system.id))
    .where(eq(runbook.id, id))
    .then(takeFirst);

  return [
    { type: "runbook" as const, id: result.runbook.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getSystemScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .where(eq(system.id, id))
    .then(takeFirst);

  return [
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getWorkspaceScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, id))
    .then(takeFirst);

  return [{ type: "workspace" as const, id: result.id }];
};

const getJobAgentScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(jobAgent, eq(jobAgent.workspaceId, workspace.id))
    .where(eq(jobAgent.id, id))
    .then(takeFirst);

  return [
    { type: "jobAgent" as const, id: result.job_agent.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getJobScopes = async (id: string) => {
  const runbookResult = await db
    .select()
    .from(job)
    .innerJoin(runbookJobTrigger, eq(runbookJobTrigger.jobId, job.id))
    .innerJoin(runbook, eq(runbookJobTrigger.runbookId, runbook.id))
    .innerJoin(system, eq(runbook.systemId, system.id))
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(eq(job.id, id))
    .then(takeFirstOrNull);

  if (runbookResult != null)
    return [
      { type: "job" as const, id: runbookResult.job.id },
      { type: "runbook" as const, id: runbookResult.runbook.id },
      { type: "system" as const, id: runbookResult.system.id },
      { type: "workspace" as const, id: runbookResult.workspace.id },
    ];

  const result = await db
    .select()
    .from(job)
    .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
    .innerJoin(target, eq(releaseJobTrigger.targetId, target.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(deployment, eq(release.deploymentId, deployment.id))
    .innerJoin(system, eq(deployment.systemId, system.id))
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(eq(job.id, id))
    .then(takeFirstOrNull);

  if (result == null) return [];

  return [
    { type: "job" as const, id: result.job.id },
    { type: "resource" as const, id: result.resource.id },
    { type: "environment" as const, id: result.environment.id },
    { type: "release" as const, id: result.release.id },
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

type Scope = { type: ScopeType; id: string };

export const scopeHandlers: Record<
  ScopeType,
  (id: string) => Promise<Array<Scope>>
> = {
  resource: getTargetScopes,
  resourceView: getTargetViewScopes,
  resourceProvider: getTargetProviderScopes,
  deployment: getDeploymentScopes,
  deploymentVariable: getDeploymentVariableScopes,
  runbook: getRunbookScopes,
  system: getSystemScopes,
  workspace: getWorkspaceScopes,
  environment: getEnvironmentScopes,
  environmentPolicy: getEnvironmentPolicyScopes,
  release: getReleaseScopes,
  releaseChannel: getReleaseChannelScopes,
  resourceMetadataGroup: getTargetMetadataGroupScopes,
  variableSet: getVariableSetScopes,
  jobAgent: getJobAgentScopes,
  job: getJobScopes,
};

const fetchScopeHierarchyForResource = async (resource: {
  type: ScopeType;
  id: string;
}): Promise<Array<Scope>> => {
  const handler = scopeHandlers[resource.type];
  return handler(resource.id);
};
