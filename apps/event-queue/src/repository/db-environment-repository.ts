import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbEnvironmentRepository implements Repository<schema.Environment> {
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? db;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    return this.db
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.environment.id, id),
          eq(schema.system.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => row?.environment ?? null);
  }

  @Trace()
  async getAll() {
    return this.db
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((results) => results.map((result) => result.environment));
  }
  async create(entity: schema.Environment) {
    return this.db
      .insert(schema.environment)
      .values(entity)
      .returning()
      .then(takeFirst);
  }
  async update(entity: schema.Environment) {
    return this.db
      .update(schema.environment)
      .set(entity)
      .where(eq(schema.environment.id, entity.id))
      .returning()
      .then(takeFirst);
  }
  async delete(id: string) {
    return this.db
      .delete(schema.environment)
      .where(eq(schema.environment.id, id))
      .returning()
      .then(takeFirstOrNull);
  }
  async exists(id: string) {
    return this.db
      .select()
      .from(schema.environment)
      .where(eq(schema.environment.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
