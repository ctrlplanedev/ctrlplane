import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import {
  and,
  desc,
  eq,
  gte,
  lte,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { Policy, RuleEngineContext } from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { VersionRuleEngine } from "../manager/version-rule-engine.js";
import { mergePolicies } from "../utils/merge-policies.js";
import { getRules } from "./version-manager-rules.js";

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
    return this.db
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
  }

  async findVersionsForEvaluate() {
    const [latestDeployedVersion, latestVersionMatchingPolicy] =
      await Promise.all([
        this.findLastestDeployedVersion(),
        this.findLatestVersionMatchingPolicy(),
      ]);

    const policy = await this.getPolicy();

    return this.db.query.deploymentVersion
      .findMany({
        where: and(
          eq(
            schema.deploymentVersion.deploymentId,
            this.releaseTarget.deploymentId,
          ),
          schema.deploymentVersionMatchesCondition(
            this.db,
            policy?.deploymentVersionSelector?.deploymentVersionSelector,
          ),
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
        with: { metadata: true },
        orderBy: desc(schema.deploymentVersion.createdAt),
      })
      .then((versions) =>
        versions.map((version) => ({
          ...version,
          metadata: Object.fromEntries(
            version.metadata.map((m) => [m.key, m.value]),
          ),
        })),
      );
  }

  async findLatestRelease() {
    return this.db.query.versionRelease.findFirst({
      where: eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
      orderBy: desc(schema.versionRelease.createdAt),
    });
  }

  async getPolicy(forceRefresh = false): Promise<Policy | null> {
    if (!forceRefresh && this.cachedPolicy !== null) return this.cachedPolicy;

    const policies = await getApplicablePolicies(
      this.db,
      this.releaseTarget.workspaceId,
      this.releaseTarget,
    );

    this.cachedPolicy = mergePolicies(policies);
    return this.cachedPolicy;
  }

  async evaluate() {
    const ctx: RuleEngineContext | undefined =
      await this.db.query.releaseTarget.findFirst({
        where: eq(schema.releaseTarget.id, this.releaseTarget.id),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
      });

    if (ctx == null)
      throw new Error(`Release target ${this.releaseTarget.id} not found`);

    const policy = await this.getPolicy();
    const rules = getRules(policy);

    const engine = new VersionRuleEngine(rules);
    const versions = await this.findVersionsForEvaluate();
    const result = await engine.evaluate(ctx, versions);
    return result;
  }
}
