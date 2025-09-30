import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";

export class DbGithubEntityRepository
  implements Repository<schema.GithubEntity>
{
  private readonly db: Tx;
  private readonly workspaceId: string;

  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    return this.db
      .select()
      .from(schema.githubEntity)
      .where(eq(schema.githubEntity.id, id))
      .then(takeFirstOrNull);
  }

  async getAll() {
    return this.db
      .select()
      .from(schema.githubEntity)
      .where(eq(schema.githubEntity.workspaceId, this.workspaceId));
  }

  async create(entity: schema.GithubEntity) {
    return this.db
      .insert(schema.githubEntity)
      .values({ ...entity, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
  }

  async update(entity: schema.GithubEntity) {
    return this.db
      .update(schema.githubEntity)
      .set(entity)
      .where(eq(schema.githubEntity.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  async delete(id: string) {
    return this.db
      .delete(schema.githubEntity)
      .where(eq(schema.githubEntity.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  async exists(id: string) {
    return this.db
      .select()
      .from(schema.githubEntity)
      .where(eq(schema.githubEntity.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
