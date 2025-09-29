import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbVersionRepository
  implements Repository<schema.DeploymentVersion>
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
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, id))
      .then(takeFirstOrNull);
  }

  @Trace()
  getAll(): Promise<schema.DeploymentVersion[]> {
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((results) => results.map((result) => result.deployment_version));
  }
  create(entity: schema.DeploymentVersion): Promise<schema.DeploymentVersion> {
    return this.db
      .insert(schema.deploymentVersion)
      .values(entity)
      .returning()
      .then(takeFirst);
  }
  update(entity: schema.DeploymentVersion): Promise<schema.DeploymentVersion> {
    return this.db
      .update(schema.deploymentVersion)
      .set(entity)
      .where(eq(schema.deploymentVersion.id, entity.id))
      .returning()
      .then(takeFirst);
  }
  delete(id: string): Promise<schema.DeploymentVersion | null> {
    return this.db
      .delete(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, id))
      .returning()
      .then(takeFirstOrNull);
  }
  exists(id: string): Promise<boolean> {
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
