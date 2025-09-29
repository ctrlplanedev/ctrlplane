import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbDeploymentRepository implements Repository<schema.Deployment> {
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? db;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    return this.db
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.deployment.id, id),
          eq(schema.system.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.deployment ?? null);
  }

  @Trace()
  async getAll() {
    return this.db
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((results) => results.map((result) => result.deployment));
  }
  async create(entity: schema.Deployment) {
    return this.db
      .insert(schema.deployment)
      .values(entity)
      .returning()
      .then(takeFirst);
  }
  async update(entity: schema.Deployment) {
    return this.db
      .update(schema.deployment)
      .set(entity)
      .where(eq(schema.deployment.id, entity.id))
      .returning()
      .then(takeFirst);
  }
  async delete(id: string) {
    return this.db
      .delete(schema.deployment)
      .where(eq(schema.deployment.id, id))
      .returning()
      .then(takeFirstOrNull);
  }
  async exists(id: string) {
    return this.db
      .select()
      .from(schema.deployment)
      .where(eq(schema.deployment.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
