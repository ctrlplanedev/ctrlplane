import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbDeploymentVariableRepository
  implements Repository<schema.DeploymentVariable>
{
  private readonly db: Tx;
  private readonly workspaceId: string;
  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  get(id: string) {
    return this.db
      .select()
      .from(schema.deploymentVariable)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.deploymentVariable.id, id))
      .then(takeFirstOrNull)
      .then((row) => row?.deployment_variable ?? null);
  }

  @Trace()
  getAll() {
    return this.db
      .select()
      .from(schema.deploymentVariable)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((results) => results.map((result) => result.deployment_variable));
  }

  create(entity: schema.DeploymentVariable) {
    return this.db
      .insert(schema.deploymentVariable)
      .values(entity)
      .returning()
      .then(takeFirst);
  }

  update(entity: schema.DeploymentVariable) {
    return this.db
      .update(schema.deploymentVariable)
      .set(entity)
      .where(eq(schema.deploymentVariable.id, entity.id))
      .returning()
      .then(takeFirst);
  }

  delete(id: string) {
    return this.db
      .delete(schema.deploymentVariable)
      .where(eq(schema.deploymentVariable.id, id))
      .returning()
      .then(takeFirstOrNull);
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.deploymentVariable)
      .where(eq(schema.deploymentVariable.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
