import type { Tx } from "@ctrlplane/db";
import type {
  ReleaseJobTrigger,
  ReleaseJobTriggerInsert,
  ReleaseJobTriggerType,
} from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import { and, arrayContains, eq, inArray, isNull, sql } from "@ctrlplane/db";
import {
  deployment,
  environment,
  release,
  releaseJobTrigger,
  target,
} from "@ctrlplane/db/schema";

type FilterFunc = (
  tx: Tx,
  insertJobConfigs: ReleaseJobTriggerInsert[],
) => Promise<ReleaseJobTriggerInsert[]> | ReleaseJobTriggerInsert[];

type ThenFunc = (
  tx: Tx,
  jobConfigs: ReleaseJobTrigger[],
) => Promise<void> | void;

export const createReleaseJobTriggers = (tx: Tx, type: ReleaseJobTriggerType) =>
  new ReleaseJobTriggerBuilder(tx, type);

class ReleaseJobTriggerBuilder {
  private _causedById?: string;

  private environmentIds?: string[];
  private targetIds?: string[];
  private releaseIds?: string[];

  private _filters: FilterFunc[] = [];
  private _then: ThenFunc[] = [];

  constructor(
    private tx: Tx,
    private type: ReleaseJobTriggerType,
  ) {}

  causedById(id: string) {
    this._causedById = id;
    return this;
  }

  filter(fn: FilterFunc) {
    this._filters.push(fn);
    return this;
  }

  then(fn: ThenFunc) {
    this._then.push(fn);
    return this;
  }

  targets(ids: string[]) {
    this.targetIds = ids;
    return this;
  }

  environments(ids: string[]) {
    this.environmentIds = ids;
    return this;
  }

  releases(ids: string[]) {
    this.releaseIds = ids;
    return this;
  }

  _where() {
    return and(
      ...[
        this.releaseIds && inArray(release.id, this.releaseIds),
        this.targetIds && inArray(target.id, this.targetIds),
        this.environmentIds && inArray(environment.id, this.environmentIds),
      ].filter(isPresent),
      isNull(environment.deletedAt),
      isNull(target.lockedAt),
    );
  }

  _baseQuery() {
    return this.tx
      .select()
      .from(environment)
      .innerJoin(target, arrayContains(target.labels, environment.targetFilter))
      .innerJoin(deployment, eq(deployment.systemId, environment.systemId));
  }

  _releaseSubQuery() {
    return this.tx
      .select({
        id: release.id,
        deploymentId: release.deploymentId,
        version: release.version,
        rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY deployment_id ORDER BY created_at DESC)`.as(
          "rank",
        ),
      })
      .from(release)
      .as("release");
  }

  async values() {
    const latestReleaseSubQuery = this._releaseSubQuery();
    const jobConfigs = this.releaseIds
      ? this._baseQuery().innerJoin(
          release,
          eq(release.deploymentId, deployment.id),
        )
      : this._baseQuery().innerJoin(
          latestReleaseSubQuery,
          and(
            eq(latestReleaseSubQuery.deploymentId, deployment.id),
            eq(latestReleaseSubQuery.rank, 1),
          ),
        );

    return jobConfigs.where(this._where());
  }

  async insert() {
    const vals = await this.values();
    if (vals.length === 0) return [];

    let wt: ReleaseJobTriggerInsert[] = vals.map((v) => ({
      type: this.type,
      causedById: this._causedById,
      targetId: v.target.id,
      environmentId: v.environment.id,
      releaseId: v.release.id,
    }));

    for (const func of this._filters) wt = await func(this.tx, wt);

    if (wt.length === 0) return [];

    const jobConfigs = await this.tx
      .insert(releaseJobTrigger)
      .values(wt)
      .returning();

    for (const func of this._then) await func(this.tx, jobConfigs);

    return jobConfigs;
  }
}
