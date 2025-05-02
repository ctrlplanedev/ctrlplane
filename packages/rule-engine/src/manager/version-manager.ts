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

import type { Version } from "../manager/version-rule-engine.js";
import type { FilterRule, Policy, PreValidationRule } from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { VersionRuleEngine } from "../manager/version-rule-engine.js";
import { mergePolicies } from "../utils/merge-policies.js";
import { getRules } from "./version-manager-rules.js";

type VersionEvaluateOptions = {
  rules?: (p: Policy | null) => Array<FilterRule<Version> | PreValidationRule>;
  versions?: Version[];
  policy?: Policy;
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

    const deploymentVersion = await this.db.query.deploymentVersion.findFirst({
      where: and(
        eq(
          schema.deploymentVersion.deploymentId,
          this.releaseTarget.deploymentId,
        ),
        schema.deploymentVersionMatchesCondition(
          this.db,
          policy?.deploymentVersionSelector?.deploymentVersionSelector,
        ),
      ),
      orderBy: desc(schema.deploymentVersion.createdAt),
    });

    return deploymentVersion;
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

  async findVersionsForEvaluate() {
    const [latestVersionMatchingPolicy, latestDeployedVersion] =
      await Promise.all([
        this.findLatestVersionMatchingPolicy(),
        this.findLastestDeployedVersion(),
      ]);

    const policy = await this.getPolicy();
    const sql = selector()
      .query()
      .deploymentVersions()
      .where(policy?.deploymentVersionSelector?.deploymentVersionSelector)
      .sql();
    const versions = await this.db.query.deploymentVersion.findMany({
      where: and(
        eq(
          schema.deploymentVersion.deploymentId,
          this.releaseTarget.deploymentId,
        ),
        sql,
        latestDeployedVersion != null
          ? gte(
              schema.deploymentVersion.createdAt,
              latestDeployedVersion.createdAt,
            )
          : undefined,
        latestVersionMatchingPolicy != null
          ? lte(
              schema.deploymentVersion.createdAt,
              latestVersionMatchingPolicy.createdAt,
            )
          : undefined,
      ),
      orderBy: desc(schema.deploymentVersion.createdAt),
      limit: 1_000,
      with: { metadata: true },
    });

    return versions.map((v) => ({
      ...v,
      metadata: Object.fromEntries(v.metadata.map((m) => [m.key, m.value])),
    }));
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
    const rules = (options?.rules ?? getRules)(policy);

    const engine = new VersionRuleEngine(rules);
    const versions =
      options?.versions ?? (await this.findVersionsForEvaluate());

    const result = await engine.evaluate(versions);
    return result;
  }
}
