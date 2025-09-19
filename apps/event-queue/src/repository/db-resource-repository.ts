import type { Tx } from "@ctrlplane/db";
import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import {
  buildConflictUpdateColumns,
  eq,
  inArray,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "./repository.js";

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
    return this.db.transaction(async (tx) => {
      const resource = await tx
        .insert(schema.resource)
        .values({ ...entity, workspaceId: this.workspaceId })
        .returning()
        .then(takeFirst);
      const metadata =
        Object.keys(entity.metadata).length > 0
          ? await tx
              .insert(schema.resourceMetadata)
              .values(
                Object.entries(entity.metadata).map(([key, value]) => ({
                  resourceId: resource.id,
                  key,
                  value,
                })),
              )
              .returning()
              .then((rows) =>
                Object.fromEntries(rows.map((r) => [r.key, r.value])),
              )
          : {};
      return { ...resource, metadata };
    });
  }
  async update(entity: FullResource) {
    return this.db.transaction(async (tx) => {
      const resource = await tx
        .update(schema.resource)
        .set(entity)
        .where(eq(schema.resource.id, entity.id))
        .returning()
        .then(takeFirst);

      const existingMetadata = await tx
        .select()
        .from(schema.resourceMetadata)
        .where(eq(schema.resourceMetadata.resourceId, entity.id));

      const currentKeys = new Set(existingMetadata.map((m) => m.key));
      const removedKeys = Array.from(currentKeys).filter(
        (key) => !entity.metadata[key],
      );

      if (removedKeys.length > 0)
        await tx
          .delete(schema.resourceMetadata)
          .where(inArray(schema.resourceMetadata.key, removedKeys));

      const metadata =
        Object.keys(entity.metadata).length > 0
          ? await tx
              .insert(schema.resourceMetadata)
              .values(
                Object.entries(entity.metadata).map(([key, value]) => ({
                  resourceId: resource.id,
                  key,
                  value,
                })),
              )
              .onConflictDoUpdate({
                target: [
                  schema.resourceMetadata.resourceId,
                  schema.resourceMetadata.key,
                ],
                set: buildConflictUpdateColumns(schema.resourceMetadata, [
                  "value",
                ]),
              })
              .returning()
              .then((rows) =>
                Object.fromEntries(rows.map((r) => [r.key, r.value])),
              )
          : {};

      return { ...resource, metadata };
    });
  }
  async delete(id: string) {
    return this.db.transaction(async (tx) => {
      const resource = await tx
        .update(schema.resource)
        .set({ deletedAt: new Date() })
        .where(eq(schema.resource.id, id))
        .returning()
        .then(takeFirstOrNull);

      if (resource == null) return null;

      const metadata = await tx
        .delete(schema.resourceMetadata)
        .where(eq(schema.resourceMetadata.resourceId, id))
        .returning()
        .then((rows) => Object.fromEntries(rows.map((r) => [r.key, r.value])));

      return { ...resource, metadata };
    });
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
