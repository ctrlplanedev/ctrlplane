import type { Tx } from "@ctrlplane/db";
import { isAfter, isBefore } from "date-fns";

import {
  and,
  desc,
  eq,
  inArray,
  or,
  selector,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import type { Version } from "../manager/version-rule-engine.js";
import type { FilterRule, Policy, PreValidationRule } from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import type { GetAllRulesOptions } from "./version-manager-rules.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { VersionRuleEngine } from "../manager/version-rule-engine.js";
import { mergePolicies } from "../utils/merge-policies.js";
import { getAllRules } from "./version-manager-rules.js";

const log = logger.child({ module: "version-manager" });

export type VersionEvaluateOptions = {
  rules?: (
    opts: GetAllRulesOptions,
  ) => Promise<Array<FilterRule<Version> | PreValidationRule>>;
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

  async getVersionsMatchingTarget() {
    const policy = await this.getPolicy();
    const isMatchingPolicySelector = selector()
      .query()
      .deploymentVersions()
      .where(policy?.deploymentVersionSelector?.deploymentVersionSelector)
      .sql();

    const versions = await this.db
      .select()
      .from(schema.deploymentVersion)
      .where(
        and(
          eq(
            schema.deploymentVersion.deploymentId,
            this.releaseTarget.deploymentId,
          ),
          isMatchingPolicySelector,
          eq(schema.deploymentVersion.status, DeploymentVersionStatus.Ready),
        ),
      )
      .orderBy(desc(schema.deploymentVersion.createdAt))
      .limit(500);

    return versions;
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
          or(
            eq(schema.job.status, JobStatus.Successful),
            eq(schema.job.status, JobStatus.InProgress),
          ),
          eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
        ),
      )
      .orderBy(desc(schema.job.createdAt))
      .limit(1)
      .then(takeFirstOrNull)
      .then((result) => result?.deployment_version);
  }

  async findDesiredVersion() {
    const { desiredVersionId } = this.releaseTarget;
    if (desiredVersionId == null) return null;
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, desiredVersionId))
      .then(takeFirst);
  }

  async getMinVersionCreatedAt() {
    const latestDeployedVersion = await this.findLastestDeployedVersion();
    return latestDeployedVersion?.createdAt;
  }

  getMaxVersionCreatedAt(versions: schema.DeploymentVersion[]) {
    const [latestVersion] = versions;
    return latestVersion?.createdAt;
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

  async getVersionsForEvaluate() {
    const desiredVersion = await this.findDesiredVersion();
    if (desiredVersion != null) return [desiredVersion];

    const versions = await this.getVersionsMatchingTarget();
    const minVersionCreatedAt = await this.getMinVersionCreatedAt();
    const maxVersionCreatedAt = this.getMaxVersionCreatedAt(versions);

    return versions.filter((version) => {
      if (
        minVersionCreatedAt != null &&
        isBefore(version.createdAt, minVersionCreatedAt)
      )
        return false;
      if (
        maxVersionCreatedAt != null &&
        isAfter(version.createdAt, maxVersionCreatedAt)
      )
        return false;
      return true;
    });
  }

  async prevalidateProvidedVersions(versions: Version[]) {
    const desiredVersion = await this.findDesiredVersion();
    if (desiredVersion != null)
      return versions.filter((version) => version.id === desiredVersion.id);

    const latestDeployedVersion = await this.findLastestDeployedVersion();
    const versionsNewerThanLatest = versions.filter((version) =>
      isAfter(
        version.createdAt,
        latestDeployedVersion?.createdAt ?? new Date(0),
      ),
    );
    if (versionsNewerThanLatest.length === 0) return [];

    const policy = await this.getPolicy();
    const deploymentVersionSelector =
      policy?.deploymentVersionSelector?.deploymentVersionSelector;

    const isMatchingSelector = selector()
      .query()
      .deploymentVersions()
      .where(deploymentVersionSelector)
      .sql();

    const isTargetedId =
      versionsNewerThanLatest.length === 1
        ? eq(schema.deploymentVersion.id, versionsNewerThanLatest.at(0)!.id)
        : inArray(
            schema.deploymentVersion.id,
            versionsNewerThanLatest.map((v) => v.id),
          );

    const isReady = eq(
      schema.deploymentVersion.status,
      DeploymentVersionStatus.Ready,
    );

    const checks = [
      ...(deploymentVersionSelector != null ? [isMatchingSelector] : []),
      isTargetedId,
      isReady,
    ];

    const validVersions = await this.db
      .select()
      .from(schema.deploymentVersion)
      .where(and(...checks))
      .orderBy(desc(schema.deploymentVersion.createdAt));

    return validVersions;
  }

  async evaluate(options?: VersionEvaluateOptions) {
    try {
      const policy = options?.policy ?? (await this.getPolicy());
      const getRules = options?.rules ?? getAllRules;
      const rules = await getRules({
        policy,
        releaseTargetId: this.releaseTarget.id,
      });

      const engine = new VersionRuleEngine(rules);
      const versions = options?.versions
        ? await this.prevalidateProvidedVersions(options.versions)
        : await this.getVersionsForEvaluate();

      const result = await engine.evaluate(versions);
      return result;
    } catch (e) {
      log.error(
        `Failed to evaluate versions for release target ${this.releaseTarget.id}, ${JSON.stringify(e)}`,
      );
      return { chosenCandidate: null, rejectionReasons: new Map() };
    }
  }
}
