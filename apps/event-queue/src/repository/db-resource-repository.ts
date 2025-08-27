import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";

export class DbResourceRepository implements Repository<schema.Resource> {
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? db;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    return this.db
      .select()
      .from(schema.resource)
      .where(
        and(
          eq(schema.resource.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull);
  }
  async getAll() {
    return this.db
      .select()
      .from(schema.resource)
      .where(eq(schema.resource.workspaceId, this.workspaceId));
  }
  async create(entity: schema.Resource) {
    return this.db
      .insert(schema.resource)
      .values({ ...entity, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
  }
  async update(entity: schema.Resource) {
    return this.db
      .update(schema.resource)
      .set(entity)
      .where(eq(schema.resource.id, entity.id))
      .returning()
      .then(takeFirst);
  }
  async delete(id: string) {
    return this.db
      .delete(schema.resource)
      .where(eq(schema.resource.id, id))
      .returning()
      .then(takeFirstOrNull);
  }
  async exists(id: string) {
    return this.db
      .select()
      .from(schema.resource)
      .where(eq(schema.resource.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
