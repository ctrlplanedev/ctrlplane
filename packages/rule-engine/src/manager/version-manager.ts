import type { Tx } from "@ctrlplane/db";

import {
  and,
  desc,
  eq,
  gte,
  lte,
  selector,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import type { Version } from "../manager/version-rule-engine.js";
import type { FilterRule, Policy, PreValidationRule } from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import type { GetRuleOptions } from "./version-manager-rules.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { VersionRuleEngine } from "../manager/version-rule-engine.js";
import { mergePolicies } from "../utils/merge-policies.js";
import { getRules } from "./version-manager-rules.js";

type VersionEvaluateOptions = {
  rules?: (
    opts: GetRuleOptions,
  ) => Promise<Array<FilterRule<Version> | PreValidationRule>>;
  versions?: Version[];
  policy?: Policy;
  evaluationRequestedById?: string;
};

export class VersionReleaseManager implements ReleaseManager {
  private cachedPolicy: Policy | null = null;
  constructor(
    private readonly db: Tx = dbClient,
    private readonly releaseTarget: ReleaseTarget,
  ) {}

  async upsertRelease(versionId: string) {
    const latestRelease = await this.findLatestRelease();
    if (latestRelease?.versionId === versionId)
      return { created: false, release: latestRelease };

    const release = await this.db
      .insert(schema.versionRelease)
      .values({ releaseTargetId: this.releaseTarget.id, versionId })
      .returning()
      .then(takeFirst);

    return { created: true, release };
  }

  async findLatestVersionMatchingPolicy() {
    const policy = await this.getPolicy();

    const sql = selector()
      .query()
      .deploymentVersions()
      .where(policy?.deploymentVersionSelector?.deploymentVersionSelector)
      .sql();

    return this.db
      .select()
      .from(schema.deploymentVersion)
      .where(
        and(
          eq(
            schema.deploymentVersion.deploymentId,
            this.releaseTarget.deploymentId,
          ),
          sql,
          eq(schema.deploymentVersion.status, DeploymentVersionStatus.Ready),
        ),
      )
      .orderBy(desc(schema.deploymentVersion.createdAt))
      .limit(1)
      .then(takeFirstOrNull);
  }

  async findLastestDeployedVersion() {
    const result = await this.db
      .select()
      .from(schema.deploymentVersion)
      .innerJoin(
        schema.versionRelease,
        eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
      )
      .innerJoin(
        schema.release,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseJob,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
      .where(
        and(
          eq(schema.job.status, JobStatus.Successful),
          eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
        ),
      )
      .orderBy(desc(schema.job.createdAt))
      .limit(1)
      .then(takeFirstOrNull)
      .then((result) => result?.deployment_version);

    return result;
  }

  async getPolicySelectorSql() {
    const policy = await this.getPolicy();
    return selector()
      .query()
      .deploymentVersions()
      .where(policy?.deploymentVersionSelector?.deploymentVersionSelector)
      .sql();
  }

  async findDesiredVersion() {
    const isMatchingPolicySelector = await this.getPolicySelectorSql();

    const { desiredVersionId } = this.releaseTarget;
    if (desiredVersionId == null) return null;
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .where(
        and(
          eq(schema.deploymentVersion.id, desiredVersionId),
          isMatchingPolicySelector,
        ),
      )
      .then(takeFirst);
  }

  async getMinVersionCreatedAtSql() {
    const latestDeployedVersion = await this.findLastestDeployedVersion();
    if (latestDeployedVersion == null) return undefined;

    return gte(
      schema.deploymentVersion.createdAt,
      latestDeployedVersion.createdAt,
    );
  }

  async getMaxVersionCreatedAtSql() {
    const latestVersionMatchingPolicy =
      await this.findLatestVersionMatchingPolicy();
    if (latestVersionMatchingPolicy == null) return undefined;

    return lte(
      schema.deploymentVersion.createdAt,
      latestVersionMatchingPolicy.createdAt,
    );
  }

  async getDeploymentVersionChecks() {
    const [
      isAfterLatestDeployedVersion,
      isBeforeLatestVersionMatchingPolicy,
      isMatchingPolicySelector,
    ] = await Promise.all([
      this.getMinVersionCreatedAtSql(),
      this.getMaxVersionCreatedAtSql(),
      this.getPolicySelectorSql(),
    ]);

    const isReleaseTargetInDeployment = eq(
      schema.deploymentVersion.deploymentId,
      this.releaseTarget.deploymentId,
    );

    return and(
      isReleaseTargetInDeployment,
      isAfterLatestDeployedVersion,
      isBeforeLatestVersionMatchingPolicy,
      isMatchingPolicySelector,
    );
  }

  async findVersionsForEvaluate() {
    const desiredVersion = await this.findDesiredVersion();
    if (desiredVersion != null) return [desiredVersion];

    const deploymentVersionChecks = await this.getDeploymentVersionChecks();

    return this.db
      .select()
      .from(schema.deploymentVersion)
      .where(deploymentVersionChecks)
      .orderBy(desc(schema.deploymentVersion.createdAt))
      .limit(1_000);
  }

  async findLatestRelease() {
    return this.db.query.versionRelease.findFirst({
      where: eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
      orderBy: desc(schema.versionRelease.createdAt),
    });
  }

  async getPolicy(forceRefresh = false): Promise<Policy | null> {
    if (!forceRefresh && this.cachedPolicy != null) return this.cachedPolicy;

    const policies = await getApplicablePolicies(
      this.db,
      this.releaseTarget.id,
    );

    this.cachedPolicy = mergePolicies(policies);
    return this.cachedPolicy;
  }

  async evaluate(options?: VersionEvaluateOptions) {
    const policy = options?.policy ?? (await this.getPolicy());
    const ruleGetter = options?.rules ?? getRules;
    const rules = await ruleGetter({
      policy,
      releaseTargetId: this.releaseTarget.id,
      evaluationRequestedById: options?.evaluationRequestedById,
    });

    const engine = new VersionRuleEngine(rules);
    const versions =
      options?.versions ?? (await this.findVersionsForEvaluate());

    const result = await engine.evaluate(versions);
    return result;
  }
}
