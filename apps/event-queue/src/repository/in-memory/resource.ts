import type { Tx } from "@ctrlplane/db";
import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, isNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";

type InMemoryResourceRepositoryOptions = {
  initialEntities: FullResource[];
  tx?: Tx;
};

const getInitialEntities = async (workspaceId: string) => {
  const dbResult = await dbClient
    .select()
    .from(schema.resource)
    .leftJoin(
      schema.resourceMetadata,
      eq(schema.resource.id, schema.resourceMetadata.resourceId),
    )
    .where(
      and(
        eq(schema.resource.workspaceId, workspaceId),
        isNull(schema.resource.deletedAt),
      ),
    );

  return _.chain(dbResult)
    .groupBy((row) => row.resource.id)
    .map((group) => {
      const [first] = group;
      if (first == null) return null;
      const { resource } = first;
      const metadata = Object.fromEntries(
        group
          .map((r) => r.resource_metadata)
          .filter(isPresent)
          .map((m) => [m.key, m.value]),
      );
      return { ...resource, metadata };
    })
    .value()
    .filter(isPresent);
};

export class InMemoryResourceRepository implements Repository<FullResource> {
  private entities: Map<string, FullResource>;
  private db: Tx;

  constructor(opts: InMemoryResourceRepositoryOptions) {
    this.entities = new Map();
    for (const entity of opts.initialEntities)
      this.entities.set(entity.id, entity);
    this.db = opts.tx ?? dbClient;
  }
  static async create(workspaceId: string) {
    const initialEntities = await getInitialEntities(workspaceId);
    const inMemoryResourceRepository = new InMemoryResourceRepository({
      initialEntities,
      tx: dbClient,
    });
    return inMemoryResourceRepository;
  }

  get(id: string) {
    return this.entities.get(id) ?? null;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  async create(entity: FullResource) {
    this.entities.set(entity.id, entity);
    await this.db.insert(schema.resource).values(entity).onConflictDoNothing();
    return entity;
  }

  async update(entity: FullResource) {
    this.entities.set(entity.id, entity);
    await this.db
      .update(schema.resource)
      .set(entity)
      .where(eq(schema.resource.id, entity.id));
    return entity;
  }

  async delete(id: string) {
    const entity = this.entities.get(id);
    if (entity == null) return null;
    this.entities.delete(id);
    await this.db.delete(schema.resource).where(eq(schema.resource.id, id));
    return entity;
  }

  exists(id: string) {
    return this.entities.has(id);
  }
}
