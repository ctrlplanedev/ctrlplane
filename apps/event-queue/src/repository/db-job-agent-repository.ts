import type { Tx } from "@ctrlplane/db";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbJobAgentRepository implements Repository<schema.JobAgent> {
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  get(id: string) {
    return this.db
      .select()
      .from(schema.jobAgent)
      .where(
        and(
          eq(schema.jobAgent.id, id),
          eq(schema.jobAgent.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull);
  }

  @Trace("db-job-agent-repository-getAll")
  getAll() {
    return this.db
      .select()
      .from(schema.jobAgent)
      .where(eq(schema.jobAgent.workspaceId, this.workspaceId));
  }

  create(entity: schema.JobAgent) {
    return this.db
      .insert(schema.jobAgent)
      .values({ ...entity, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.JobAgent) {
    return this.db
      .update(schema.jobAgent)
      .set(entity)
      .where(eq(schema.jobAgent.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.jobAgent)
      .where(eq(schema.jobAgent.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.jobAgent)
      .where(
        and(
          eq(schema.jobAgent.id, id),
          eq(schema.jobAgent.workspaceId, this.workspaceId),
        ),
      )
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
