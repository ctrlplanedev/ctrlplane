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
const checkEntityPermissionForScopes = (
  entity: { type: EntityType; id: string },
  scopes: Array<{ type: ScopeType; id: string }>,
  permission: string,
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
        eq(rolePermission.permission, permission),
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

export const hasPermission = async (
  entity: { type: EntityType; id: string },
  resource: { type: ScopeType; id: string },
  permission: string,
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

  const role = await checkEntityPermissionForScopes(entity, scopes, permission);

  return role != null;
};
