import type { Tx } from "@ctrlplane/db";
import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";
import { Trace } from "../traces.js";

export class DbResourceRepository implements Repository<FullResource> {
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
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(eq(schema.resource.id, id))
      .then((rows) => {
        const [first] = rows;
        if (first == null) return null;
        const { resource } = first;
        const metadata = Object.fromEntries(
          rows
            .map((r) => r.resource_metadata)
            .filter(isPresent)
            .map((m) => [m.key, m.value]),
        );
        return { ...resource, metadata };
      });
  }

  @Trace("db-resource-repository-getAll")
  async getAll() {
    const dbResult = await this.db
      .select()
      .from(schema.resource)
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId));

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
  }

  async create(entity: FullResource) {
    await this.db
      .insert(schema.resource)
      .values({ ...entity, workspaceId: this.workspaceId })
      .returning()
      .then(takeFirst);
    return entity;
  }
  async update(entity: FullResource) {
    await this.db
      .update(schema.resource)
      .set(entity)
      .where(eq(schema.resource.id, entity.id))
      .returning()
      .then(takeFirst);
    return entity;
  }
  async delete(id: string) {
    const resource = await this.db
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(eq(schema.resource.id, id))
      .returning()
      .then(takeFirstOrNull);
    if (resource == null) return null;
    return { ...resource, metadata: {} };
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
