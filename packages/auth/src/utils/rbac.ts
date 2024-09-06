import type { EntityType, ScopeType } from "@ctrlplane/db/schema";

import {
  and,
  eq,
  inArray,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  entityRole,
  role,
  rolePermission,
  system,
  workspace,
} from "@ctrlplane/db/schema";

const scopeHierarchy: Array<ScopeType> = ["deployment", "system", "workspace"];

/**
 * Returns the first matching scope
 */
const checkEntityPermissionForScopes = async (
  entity: { type: EntityType; id: string },
  scopes: Array<{ type: ScopeType; id: string }>,
  permissions: string[],
) => {
  return db
    .select()
    .from(entityRole)
    .innerJoin(role, eq(entityRole.roleId, role.id))
    .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .where(
      and(
        eq(entityRole.entityId, entity.id),
        eq(entityRole.entityType, entity.type),
        inArray(rolePermission.permission, permissions),
        inArray(
          entityRole.scopeId,
          scopes.map((scope) => scope.id),
        ),
      ),
    )
    .orderBy(sql`ARRAY_POSITION(${scopeHierarchy}, ${entityRole.scopeType})`)
    .limit(1)
    .then(takeFirstOrNull);
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
  const scopes: Array<{ type: ScopeType; id: string }> = [];

  if (resource.type === "deployment") {
    const result = await db
      .select()
      .from(workspace)
      .innerJoin(system, eq(system.workspaceId, workspace.id))
      .innerJoin(deployment, eq(deployment.systemId, system.id))
      .where(eq(deployment.id, resource.id))
      .then(takeFirst);

    scopes.push(
      { type: "deployment", id: result.deployment.id },
      { type: "system", id: result.system.id },
      { type: "workspace", id: result.workspace.id },
    );
  }

  if (resource.type === "system") {
    const result = await db
      .select()
      .from(workspace)
      .innerJoin(system, eq(system.workspaceId, workspace.id))
      .where(eq(system.id, resource.id))
      .then(takeFirst);

    scopes.push(
      { type: "system", id: result.system.id },
      { type: "workspace", id: result.workspace.id },
    );
  }

  if (resource.type === "workspace") {
    const result = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, resource.id))
      .then(takeFirst);

    scopes.push({ type: "workspace", id: result.id });
  }

  const role = await checkEntityPermissionForScopes(
    entity,
    scopes,
    permissions,
  );

  return role != null;
};
