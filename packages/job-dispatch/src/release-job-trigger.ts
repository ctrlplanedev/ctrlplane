import type { Tx } from "@ctrlplane/db";
import type {
  ReleaseJobTrigger,
  ReleaseJobTriggerInsert,
  ReleaseJobTriggerType,
} from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, isNull, sql } from "@ctrlplane/db";
import {
  deployment,
  environment,
  job,
  jobAgent,
  release,
  releaseJobTrigger,
  system,
  target,
  targetMatchesMetadata,
} from "@ctrlplane/db/schema";

type FilterFunc = (
  tx: Tx,
  insertReleaseJobTriggers: ReleaseJobTriggerInsert[],
) => Promise<ReleaseJobTriggerInsert[]> | ReleaseJobTriggerInsert[];

type ThenFunc = (
  tx: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
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
        this.environmentIds && inArray(environment.id, this.environmentIds),
      ].filter(isPresent),
      isNull(environment.deletedAt),
      isNotNull(environment.targetFilter),
    );
  }

  _baseQuery() {
    return this.tx
      .select()
      .from(environment)
      .innerJoin(deployment, eq(deployment.systemId, environment.systemId))
      .innerJoin(system, eq(environment.systemId, system.id));
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

  async _values() {
    const latestReleaseSubQuery = this._releaseSubQuery();
    const releaseJobTriggers = this.releaseIds
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

    const releases = await releaseJobTriggers.where(this._where());
    return Promise.all(
      releases.flatMap(async (release) => {
        const { targetFilter } = release.environment;
        const { workspaceId } = release.system;
        const targets = await this.tx
          .select()
          .from(target)
          .where(
            and(
              targetMatchesMetadata(this.tx, targetFilter),
              eq(target.workspaceId, workspaceId),
              isNull(target.lockedAt),
              this.targetIds && inArray(target.id, this.targetIds),
            ),
          );

        return targets.map((target) => ({
          ...release,
          target,
        }));
      }),
    ).then((result) => result.flat());
  }

  async insert() {
    const vals = await this._values();
    if (vals.length === 0) return [];

    let wt: ReleaseJobTriggerInsert[] = vals.map((v) => ({
      type: this.type,
      causedById: this._causedById,
      targetId: v.target.id,
      environmentId: v.environment.id,
      releaseId: v.release.id,
      jobId: "",
    }));

    for (const func of this._filters) wt = await func(this.tx, wt);

    if (wt.length === 0) return [];

    const releases = await this.tx
      .select()
      .from(release)
      .innerJoin(deployment, eq(release.deploymentId, deployment.id))
      .innerJoin(jobAgent, eq(deployment.jobAgentId, jobAgent.id))
      .where(
        inArray(
          release.id,
          wt.map((t) => t.releaseId),
        ),
      );

    const jobInserts = wt
      .map((t) => {
        const release = releases.find((r) => r.release.id === t.releaseId);
        if (!release) return null;
        return {
          jobAgentId: release.job_agent.id,
          jobAgentConfig: _.merge(
            release.job_agent.config,
            release.deployment.jobAgentConfig,
          ),
        };
      })
      .filter(isPresent);

    if (jobInserts.length === 0) return [];

    const jobs = await this.tx.insert(job).values(jobInserts).returning();
    const wtWithJobId = wt.map((t, index) => ({
      ...t,
      jobId: jobs[index]!.id,
    }));

    const releaseJobTriggers = await this.tx
      .insert(releaseJobTrigger)
      .values(wtWithJobId)
      .returning();

    for (const func of this._then) await func(this.tx, releaseJobTriggers);

    return releaseJobTriggers;
  }
}
