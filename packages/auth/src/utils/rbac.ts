import type { EntityType, ScopeType } from "@ctrlplane/db/schema";

import { and, eq, inArray, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  entityRole,
  environment,
  environmentPolicy,
  jobAgent,
  release,
  role,
  rolePermission,
  runbook,
  system,
  target,
  targetLabelGroup,
  targetProvider,
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

const getTargetLabelGroupScopes = async (id: string) => {
  const result = await db
    .select()
    .from(workspace)
    .innerJoin(targetLabelGroup, eq(targetLabelGroup.workspaceId, workspace.id))
    .where(eq(targetLabelGroup.id, id))
    .then(takeFirst);

  return [
    { type: "targetLabelGroup" as const, id: result.target_label_group.id },
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
    { type: "target" as const, id: result.target.id },
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
    { type: "targetProvider" as const, id: result.target_provider.id },
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

type Scope = { type: ScopeType; id: string };

export const scopeHandlers: Record<
  ScopeType,
  (id: string) => Promise<Array<Scope>>
> = {
  target: getTargetScopes,
  targetProvider: getTargetProviderScopes,
  deployment: getDeploymentScopes,
  runbook: getRunbookScopes,
  system: getSystemScopes,
  workspace: getWorkspaceScopes,
  environment: getEnvironmentScopes,
  environmentPolicy: getEnvironmentPolicyScopes,
  release: getReleaseScopes,
  targetLabelGroup: getTargetLabelGroupScopes,
  variableSet: getVariableSetScopes,
  jobAgent: getJobAgentScopes,
};

const fetchScopeHierarchyForResource = async (resource: {
  type: ScopeType;
  id: string;
}): Promise<Array<Scope>> => {
  const handler = scopeHandlers[resource.type];
  return handler(resource.id);
};
