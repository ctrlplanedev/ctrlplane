import type { Tx } from "@ctrlplane/db";
import type {
  ReleaseJobTrigger,
  ReleaseJobTriggerInsert,
  ReleaseJobTriggerType,
} from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, isNull, sql } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

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
  private resourceIds?: string[];
  private deploymentIds?: string[];
  private versionIds?: string[];

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

  resources(ids: string[]) {
    this.resourceIds = ids;
    return this;
  }

  environments(ids: string[]) {
    this.environmentIds = ids;
    return this;
  }

  deployments(ids: string[]) {
    this.deploymentIds = ids;
    return this;
  }

  versions(ids: string[]) {
    this.versionIds = ids;
    return this;
  }

  _where() {
    return and(
      ...[
        this.versionIds &&
          inArray(SCHEMA.deploymentVersion.id, this.versionIds),
        this.deploymentIds && inArray(SCHEMA.deployment.id, this.deploymentIds),
        this.environmentIds &&
          inArray(SCHEMA.environment.id, this.environmentIds),
      ].filter(isPresent),
      isNotNull(SCHEMA.environment.resourceSelector),
    );
  }

  _baseQuery() {
    return this.tx
      .select()
      .from(SCHEMA.environment)
      .innerJoin(
        SCHEMA.deployment,
        eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
      )
      .innerJoin(
        SCHEMA.system,
        eq(SCHEMA.environment.systemId, SCHEMA.system.id),
      );
  }

  _versionSubQuery() {
    return this.tx
      .select({
        id: SCHEMA.deploymentVersion.id,
        deploymentId: SCHEMA.deploymentVersion.deploymentId,
        tag: SCHEMA.deploymentVersion.tag,
        rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY deployment_id ORDER BY created_at DESC)`.as(
          "rank",
        ),
      })
      .from(SCHEMA.deploymentVersion)
      .where(eq(SCHEMA.deploymentVersion.status, DeploymentVersionStatus.Ready))
      .as("version");
  }

  async _values() {
    const latestActiveVersionSubQuery = this._versionSubQuery();
    const releaseJobTriggers = this.versionIds
      ? this._baseQuery().innerJoin(
          SCHEMA.deploymentVersion,
          and(
            eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
            eq(SCHEMA.deploymentVersion.status, DeploymentVersionStatus.Ready),
          ),
        )
      : this._baseQuery().innerJoin(
          latestActiveVersionSubQuery,
          and(
            eq(latestActiveVersionSubQuery.deploymentId, SCHEMA.deployment.id),
            eq(latestActiveVersionSubQuery.rank, 1),
          ),
        );

    const versions = await releaseJobTriggers.where(this._where());
    return Promise.all(
      versions.flatMap(async (version) => {
        const { resourceSelector } = version.environment;
        const { resourceSelector: deploymentResourceFilter } =
          version.deployment;
        const { workspaceId } = version.system;
        const resources = await this.tx
          .select()
          .from(SCHEMA.resource)
          .where(
            and(
              SCHEMA.resourceMatchesMetadata(this.tx, resourceSelector),
              SCHEMA.resourceMatchesMetadata(this.tx, deploymentResourceFilter),
              eq(SCHEMA.resource.workspaceId, workspaceId),
              isNull(SCHEMA.resource.lockedAt),
              isNull(SCHEMA.resource.deletedAt),
              this.resourceIds && inArray(SCHEMA.resource.id, this.resourceIds),
            ),
          );

        return resources.map((resource) => ({
          ...version,
          resource,
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
      resourceId: v.resource.id,
      environmentId: v.environment.id,
      versionId:
        "deployment_version" in v ? v.deployment_version.id : v.version.id,
      jobId: "",
    }));

    for (const func of this._filters) wt = await func(this.tx, wt);

    if (wt.length === 0) return [];

    const versions = await this.tx
      .select()
      .from(SCHEMA.deploymentVersion)
      .innerJoin(
        SCHEMA.deployment,
        eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
      )
      .innerJoin(
        SCHEMA.jobAgent,
        eq(SCHEMA.deployment.jobAgentId, SCHEMA.jobAgent.id),
      )
      .where(
        inArray(
          SCHEMA.deploymentVersion.id,
          wt.map((t) => t.versionId),
        ),
      );

    const jobInserts = wt
      .map((t) => {
        const version = versions.find(
          (v) => v.deployment_version.id === t.versionId,
        );
        if (!version) return null;
        return {
          jobAgentId: version.job_agent.id,
          jobAgentConfig: _.merge(
            version.job_agent.config,
            version.deployment.jobAgentConfig,
          ),
        };
      })
      .filter(isPresent);

    if (jobInserts.length === 0) return [];

    const jobs = await this.tx
      .insert(SCHEMA.job)
      .values(jobInserts)
      .returning();
    const wtWithJobId = wt.map((t, index) => ({
      ...t,
      jobId: jobs[index]!.id,
    }));

    const releaseJobTriggers = await this.tx
      .insert(SCHEMA.releaseJobTrigger)
      .values(wtWithJobId)
      .returning();

    for (const func of this._then) await func(this.tx, releaseJobTriggers);

    return releaseJobTriggers;
  }
}
