import type { Tx } from "@ctrlplane/db";
import type { FullReleaseTarget } from "@ctrlplane/events";

import { eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

const getInitialEntities = createSpanWrapper(
  "release-target-getInitialEntities",
  async (span, workspaceId: string) => {
    const rows = await dbClient
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .where(eq(schema.resource.workspaceId, workspaceId))
      .then((rows) =>
        rows.map((row) => ({
          ...row.release_target,
          resource: row.resource,
          environment: row.environment,
          deployment: row.deployment,
        })),
      );
    span.setAttributes({ "release-target.count": rows.length });
    return rows;
  },
);

const getInitialResourceMeta = createSpanWrapper(
  "release-target-getInitialResourceMeta",
  async (_span, workspaceId: string) =>
    dbClient
      .select()
      .from(schema.resourceMetadata)
      .innerJoin(
        schema.resource,
        eq(schema.resourceMetadata.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, workspaceId))
      .then((rows) => rows.map((row) => row.resource_metadata)),
);

const getFullInitialEntities = createSpanWrapper(
  "release-target-getFullInitialEntities",
  (
    _span,
    initialEntities: Awaited<ReturnType<typeof getInitialEntities>>,
    initialResourceMeta: Awaited<ReturnType<typeof getInitialResourceMeta>>,
  ): FullReleaseTarget[] => {
    return initialEntities.map((entity) => {
      const resourceMetadata = Object.fromEntries(
        initialResourceMeta
          .filter((meta) => meta.resourceId === entity.resourceId)
          .map((meta) => [meta.key, meta.value]),
      );
      const resource = { ...entity.resource, metadata: resourceMetadata };
      return { ...entity, resource };
    });
  },
);

type InMemoryReleaseTargetRepositoryOptions = {
  initialEntities: FullReleaseTarget[];
  tx?: Tx;
};

export class InMemoryReleaseTargetRepository
  implements Repository<FullReleaseTarget>
{
  private entities: Map<string, FullReleaseTarget>;
  private db: Tx;

  constructor(opts: InMemoryReleaseTargetRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }

  static async create(workspaceId: string) {
    const [allEntities, allResourceMeta] = await Promise.all([
      getInitialEntities(workspaceId),
      getInitialResourceMeta(workspaceId),
    ]);

    const initialEntities = await getFullInitialEntities(
      allEntities,
      allResourceMeta,
    );

    const inMemoryReleaseTargetRepository = new InMemoryReleaseTargetRepository(
      { initialEntities, tx: dbClient },
    );

    return inMemoryReleaseTargetRepository;
  }

  get(id: string) {
    return this.entities.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  async create(entity: FullReleaseTarget) {
    this.entities.set(entity.id, entity);
    await this.db
      .insert(schema.releaseTarget)
      .values(entity)
      .onConflictDoNothing();
    return entity;
  }

  async update(entity: FullReleaseTarget) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.releaseTarget)
      .set(entity)
      .where(eq(schema.releaseTarget.id, entity.id));

    return entity;
  }

  async delete(id: string) {
    const existing = this.entities.get(id);
    if (existing == null) return null;
    this.entities.delete(id);
    await this.db
      .delete(schema.releaseTarget)
      .where(eq(schema.releaseTarget.id, id));
    return existing;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
