import type { EntityType, ScopeType } from "@ctrlplane/db/schema";

import {
  and,
  eq,
  inArray,
  isNull,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  deploymentVariable,
  deploymentVersion,
  deploymentVersionChannel,
  entityRole,
  environment,
  environmentPolicy,
  job,
  jobAgent,
  policy,
  release,
  releaseJob,
  releaseJobTrigger,
  releaseTarget,
  resource,
  resourceMetadataGroup,
  resourceProvider,
  resourceRelationshipRule,
  resourceView,
  role,
  rolePermission,
  runbook,
  runbookJobTrigger,
  system,
  variableSet,
  versionRelease,
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

const getDeploymentVersionScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(deployment, eq(deployment.systemId, system.id))
    .innerJoin(
      deploymentVersion,
      eq(deploymentVersion.deploymentId, deployment.id),
    )
    .where(eq(deploymentVersion.id, id))
    .then(takeFirst);

  return [
    { type: "deploymentVersion" as const, id: result.deployment_version.id },
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getDeploymentVersionChannelScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(system, eq(system.workspaceId, workspace.id))
    .innerJoin(deployment, eq(deployment.systemId, system.id))
    .innerJoin(
      deploymentVersionChannel,
      eq(deploymentVersionChannel.deploymentId, deployment.id),
    )
    .where(eq(deploymentVersionChannel.id, id))
    .then(takeFirst);

  return [
    {
      type: "deploymentVersionChannel" as const,
      id: result.deployment_version_channel.id,
    },
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

const getResourceMetadataGroupScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(
      resourceMetadataGroup,
      eq(resourceMetadataGroup.workspaceId, workspace.id),
    )
    .where(eq(resourceMetadataGroup.id, id))
    .then(takeFirst);

  return [
    {
      type: "resourceMetadataGroup" as const,
      id: result.resource_metadata_group.id,
    },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getResourceScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(resource, eq(resource.workspaceId, workspace.id))
    .where(eq(resource.id, id))
    .then(takeFirst);

  return [
    { type: "resource" as const, id: result.resource.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getResourceProviderScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(resourceProvider, eq(resourceProvider.workspaceId, workspace.id))
    .where(eq(resourceProvider.id, id))
    .then(takeFirst);

  return [
    { type: "resourceProvider" as const, id: result.resource_provider.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getResourceViewScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(resourceView, eq(resourceView.workspaceId, workspace.id))
    .where(eq(resourceView.id, id))
    .then(takeFirst);

  return [
    { type: "resourceView" as const, id: result.resource_view.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getResourceRelationshipRuleScopes = async (id: string) => {
  const result = await db
    .select()
    .from(resourceRelationshipRule)
    .innerJoin(
      workspace,
      eq(resourceRelationshipRule.workspaceId, workspace.id),
    )
    .where(eq(resourceRelationshipRule.id, id))
    .then(takeFirst);

  return [
    {
      type: "resourceRelationshipRule" as const,
      id: result.resource_relationship_rule.id,
    },
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

const legacyJobScopes = async (id: string) =>
  db
    .select()
    .from(job)
    .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
    .innerJoin(resource, eq(releaseJobTrigger.resourceId, resource.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(
      deploymentVersion,
      eq(releaseJobTrigger.versionId, deploymentVersion.id),
    )
    .innerJoin(deployment, eq(deploymentVersion.deploymentId, deployment.id))
    .innerJoin(system, eq(deployment.systemId, system.id))
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(and(eq(job.id, id), isNull(resource.deletedAt)))
    .then(takeFirstOrNull);

const newJobScopes = async (id: string) =>
  db
    .select()
    .from(job)
    .innerJoin(releaseJob, eq(releaseJob.jobId, job.id))
    .innerJoin(release, eq(releaseJob.releaseId, release.id))
    .innerJoin(versionRelease, eq(release.versionReleaseId, versionRelease.id))
    .innerJoin(
      deploymentVersion,
      eq(versionRelease.versionId, deploymentVersion.id),
    )
    .innerJoin(
      releaseTarget,
      eq(versionRelease.releaseTargetId, releaseTarget.id),
    )
    .innerJoin(resource, eq(releaseTarget.resourceId, resource.id))
    .innerJoin(environment, eq(releaseTarget.environmentId, environment.id))
    .innerJoin(deployment, eq(releaseTarget.deploymentId, deployment.id))
    .innerJoin(system, eq(deployment.systemId, system.id))
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(and(eq(job.id, id), isNull(resource.deletedAt)))
    .then(takeFirstOrNull);

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

  const [newEngine, legacy] = await Promise.all([
    newJobScopes(id),
    legacyJobScopes(id),
  ]);

  const result = newEngine ?? legacy;
  if (result == null) return [];

  return [
    { type: "job" as const, id: result.job.id },
    { type: "resource" as const, id: result.resource.id },
    { type: "environment" as const, id: result.environment.id },
    { type: "deploymentVersion" as const, id: result.deployment_version.id },
    { type: "deployment" as const, id: result.deployment.id },
    { type: "system" as const, id: result.system.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getPolicyScopes = async (id: string) => {
  const result = await db
    .select()
    .from(policy)
    .innerJoin(workspace, eq(policy.workspaceId, workspace.id))
    .where(eq(policy.id, id))
    .then(takeFirst);

  return [
    { type: "policy" as const, id: result.policy.id },
    { type: "workspace" as const, id: result.workspace.id },
  ];
};

const getReleaseTargetScopes = async (id: string) => {
  const result = await db
    .select()
    .from(releaseTarget)
    .innerJoin(resource, eq(releaseTarget.resourceId, resource.id))
    .innerJoin(deployment, eq(releaseTarget.deploymentId, deployment.id))
    .innerJoin(environment, eq(releaseTarget.environmentId, environment.id))
    .innerJoin(system, eq(deployment.systemId, system.id))
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(eq(releaseTarget.id, id))
    .then(takeFirst);

  return [
    { type: "releaseTarget" as const, id: result.release_target.id },
    { type: "resource" as const, id: result.resource.id },
    { type: "environment" as const, id: result.environment.id },
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
  resource: getResourceScopes,
  resourceView: getResourceViewScopes,
  resourceProvider: getResourceProviderScopes,
  deployment: getDeploymentScopes,
  deploymentVariable: getDeploymentVariableScopes,
  runbook: getRunbookScopes,
  system: getSystemScopes,
  workspace: getWorkspaceScopes,
  environment: getEnvironmentScopes,
  environmentPolicy: getEnvironmentPolicyScopes,
  deploymentVersion: getDeploymentVersionScopes,
  deploymentVersionChannel: getDeploymentVersionChannelScopes,
  resourceMetadataGroup: getResourceMetadataGroupScopes,
  variableSet: getVariableSetScopes,
  jobAgent: getJobAgentScopes,
  job: getJobScopes,
  policy: getPolicyScopes,
  releaseTarget: getReleaseTargetScopes,
  resourceRelationshipRule: getResourceRelationshipRuleScopes,
};

const fetchScopeHierarchyForResource = async (resource: {
  type: ScopeType;
  id: string;
}): Promise<Array<Scope>> => {
  const handler = scopeHandlers[resource.type];
  return handler(resource.id);
};
