import type { EntityType, ScopeType } from "@ctrlplane/db/schema";

import { and, eq, inArray, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  deploymentVersion,
  entityRole,
  environment,
  resource,
  resourceProvider,
  role,
  rolePermission,
  system,
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

type Scope = { type: ScopeType; id: string };

export const scopeHandlers: Record<
  ScopeType,
  (id: string) => Promise<Array<Scope>>
> = {
  resource: getResourceScopes,
  resourceProvider: getResourceProviderScopes,
  deployment: getDeploymentScopes,
  system: getSystemScopes,
  workspace: getWorkspaceScopes,
  environment: getEnvironmentScopes,
  deploymentVersion: getDeploymentVersionScopes,
};

const fetchScopeHierarchyForResource = async (resource: {
  type: ScopeType;
  id: string;
}): Promise<Array<Scope>> => {
  const handler = scopeHandlers[resource.type];
  return handler(resource.id);
};
