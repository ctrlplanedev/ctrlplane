import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbPolicyRepository implements Repository<schema.Policy> {
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? db;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    return this.db
      .select()
      .from(schema.policy)
      .where(
        and(
          eq(schema.policy.id, id),
          eq(schema.policy.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull);
  }
  @Trace()
  async getAll() {
    return this.db
      .select()
      .from(schema.policy)
      .where(eq(schema.policy.workspaceId, this.workspaceId));
  }
  async create(entity: schema.Policy) {
    return this.db
      .insert(schema.policy)
      .values({ ...entity, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
  }
  async update(entity: schema.Policy) {
    return this.db
      .update(schema.policy)
      .set(entity)
      .where(eq(schema.policy.id, entity.id))
      .returning()
      .then(takeFirst);
  }
  async delete(id: string) {
    return this.db
      .delete(schema.policy)
      .where(eq(schema.policy.id, id))
      .returning()
      .then(takeFirstOrNull);
  }
  async exists(id: string) {
    return this.db
      .select()
      .from(schema.policy)
      .where(eq(schema.policy.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
