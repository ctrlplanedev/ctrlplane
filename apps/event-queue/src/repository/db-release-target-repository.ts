import type { Tx } from "@ctrlplane/db";
import type { FullReleaseTarget } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository";
import { Trace } from "../traces.js";

export class DbReleaseTargetRepository
  implements Repository<FullReleaseTarget>
{
  private readonly db: Tx;
  private readonly workspaceId: string;

  constructor(workspaceId: string, tx?: Tx) {
    this.db = tx ?? dbClient;
    this.workspaceId = workspaceId;
  }

  async get(id: string) {
    const dbResult = await this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .where(
        and(
          eq(schema.releaseTarget.id, id),
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      );

    const [first] = dbResult;
    if (first == null) return null;

    const { release_target, resource, environment, deployment } = first;
    const resourceMetadata = Object.fromEntries(
      dbResult
        .map((r) => r.resource_metadata)
        .filter(isPresent)
        .map((m) => [m.key, m.value]),
    );

    return {
      ...release_target,
      resource: { ...resource, metadata: resourceMetadata },
      environment,
      deployment,
    };
  }

  @Trace()
  async getAll() {
    const dbResult = await this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId));

    return _.chain(dbResult)
      .groupBy((row) => row.release_target.id)
      .map((group) => {
        const [first] = group;
        if (first == null) return null;
        const { release_target, resource, environment, deployment } = first;
        const resourceMetadata = Object.fromEntries(
          group
            .map((r) => r.resource_metadata)
            .filter(isPresent)
            .map((m) => [m.key, m.value]),
        );

        return {
          ...release_target,
          resource: { ...resource, metadata: resourceMetadata },
          environment,
          deployment,
        };
      })
      .value()
      .filter(isPresent);
  }

  async create(entity: FullReleaseTarget) {
    const dbResult = await this.db
      .insert(schema.releaseTarget)
      .values(entity)
      .returning()
      .then(takeFirst);

    return { ...entity, ...dbResult };
  }

  async update(entity: FullReleaseTarget) {
    const dbResult = await this.db
      .update(schema.releaseTarget)
      .set(entity)
      .where(eq(schema.releaseTarget.id, entity.id))
      .returning()
      .then(takeFirst);

    return { ...entity, ...dbResult };
  }

  async delete(id: string) {
    const existing = await this.get(id);
    if (existing == null) return null;
    await this.db
      .delete(schema.releaseTarget)
      .where(eq(schema.releaseTarget.id, id))
      .returning()
      .then(takeFirstOrNull);

    return existing;
  }

  exists(id: string) {
    return this.db
      .select()
      .from(schema.releaseTarget)
      .where(eq(schema.releaseTarget.id, id))
      .then(takeFirstOrNull)
      .then((r) => r != null);
  }
}
