import type { Tx } from "@ctrlplane/db";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import {
  getResourceChildren as dbGetResourceChildren,
  getResourceParents as dbGetResourceParents,
} from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";

import type {
  ResourceRelationshipManager,
  Rule,
} from "./resource-relationship-manager";
import { Trace } from "../traces.js";

export class DbResourceRelationshipManager
  implements ResourceRelationshipManager
{
  private readonly db: Tx;
  private readonly workspaceId: string;

  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  upsertRelationshipRule(
    relationshipRule: schema.ResourceRelationshipRule,
  ): Promise<schema.ResourceRelationshipRule> {
    return this.db
      .insert(schema.resourceRelationshipRule)
      .values({ ...relationshipRule, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
  }

  deleteRelationshipRule(
    relationshipRule: schema.ResourceRelationshipRule,
  ): Promise<schema.ResourceRelationshipRule> {
    return this.db
      .delete(schema.resourceRelationshipRule)
      .where(
        and(
          eq(schema.resourceRelationshipRule.id, relationshipRule.id),
          eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId),
        ),
      )
      .returning()
      .then(takeFirst);
  }

  getRelationshipRule(
    id: string,
  ): Promise<schema.ResourceRelationshipRule | null> {
    return this.db
      .select()
      .from(schema.resourceRelationshipRule)
      .where(
        and(
          eq(schema.resourceRelationshipRule.id, id),
          eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull);
  }

  @Trace()
  getAllRelationshipRules(): Promise<schema.ResourceRelationshipRule[]> {
    return this.db
      .select()
      .from(schema.resourceRelationshipRule)
      .where(eq(schema.resourceRelationshipRule.workspaceId, this.workspaceId));
  }

  upsertResource(resource: schema.Resource): Promise<schema.Resource> {
    return this.db
      .insert(schema.resource)
      .values({ ...resource, workspaceId: this.workspaceId })
      .onConflictDoUpdate({
        target: [schema.resource.identifier, schema.resource.workspaceId],
        set: buildConflictUpdateColumns(schema.resource, [
          "name",
          "version",
          "kind",
          "config",
          "providerId",
        ]),
      })
      .returning()
      .then(takeFirst);
  }

  deleteResource(resource: schema.Resource): Promise<schema.Resource | null> {
    return this.db
      .delete(schema.resource)
      .where(
        and(
          eq(schema.resource.id, resource.id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .returning()
      .then(takeFirstOrNull);
  }

  @Trace()
  async getResourceChildren(
    resource: schema.Resource,
  ): Promise<{ rule: Rule; target: schema.Resource }[]> {
    const children = await dbGetResourceChildren(this.db, resource.id);
    return children.map((child) => ({
      rule: { id: child.ruleId, type: child.type, reference: child.reference },
      target: child.target,
    }));
  }

  @Trace()
  async getResourceParents(
    resource: schema.Resource,
  ): Promise<{ rule: Rule; source: schema.Resource }[]> {
    const { relationships } = await dbGetResourceParents(this.db, resource.id);
    return Object.values(relationships).map((parent) => ({
      rule: {
        id: parent.ruleId,
        type: parent.type,
        reference: parent.reference,
      },
      source: parent.source,
    }));
  }
}
