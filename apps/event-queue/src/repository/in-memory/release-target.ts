import type { Tx } from "@ctrlplane/db";
import type { FullReleaseTarget } from "@ctrlplane/events";

import { eq, sql } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Repository } from "../repository";
import { createSpanWrapper } from "../../traces.js";

const getInitialEntities = createSpanWrapper(
  "release-target-getInitialEntities",
  async (span, workspaceId: string) => {
    const rows = await dbClient
      .execute(
        sql`
    select
      rt.id,
      rt.resource_id     as "resourceId",
      rt.environment_id  as "environmentId",
      rt.deployment_id   as "deploymentId",
      rt.desired_release_id  as "desiredReleaseId",
      rt.desired_version_id  as "desiredVersionId",

      (to_jsonb(r) || jsonb_build_object('metadata', coalesce(rm.metadata, '{}'::jsonb))) as "resource",
      to_jsonb(e) as "environment",
      to_jsonb(d) as "deployment"

    from "release_target" rt

    join "resource" r
      on r.id = rt.resource_id
     and r.workspace_id = ${workspaceId}

    left join lateral (
      select coalesce(jsonb_object_agg(m.key, to_jsonb(m.value)), '{}'::jsonb) as metadata
      from "resource_metadata" m
      where m.resource_id = r.id
    ) rm on true

    left join "environment" e on e.id = rt.environment_id
    left join "deployment"  d on d.id = rt.deployment_id
    `,
      )
      .then((results) => results.rows as FullReleaseTarget[]);

    console.log("sample result", { sample: rows[0] });

    span.setAttributes({ "release-target.count": rows.length });
    return rows;
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
    const initialEntities = await getInitialEntities(workspaceId);
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
