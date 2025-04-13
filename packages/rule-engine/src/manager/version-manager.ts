import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import sizeOf from "object-sizeof";

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
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { Version } from "../manager/version-rule-engine.js";
import type {
  FilterRule,
  Policy,
  PreValidationRule,
  RuleEngineContext,
} from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { VersionRuleEngine } from "../manager/version-rule-engine.js";
import { ConstantMap, isFilterRule, isPreValidationRule } from "../types.js";
import { mergePolicies } from "../utils/merge-policies.js";
import { getRules } from "./version-manager-rules.js";

const log = logger.child({
  module: "version-manager",
});

type VersionEvaluateOptions = {
  rules?: (p: Policy | null) => Array<FilterRule<Version> | PreValidationRule>;
  versions?: Version[];
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
    const startTime = performance.now();
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

    const endTime = performance.now();
    log.info(
      `[time] latest version matching policy query took ${((endTime - startTime) / 1000).toFixed(2)}s for (${this.releaseTarget.id})`,
    );

    return deploymentVersion;
  }

  async findLastestDeployedVersion() {
    const startTime = performance.now();
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

    const endTime = performance.now();
    log.info(
      `[time] lastest deployed version query took ${((endTime - startTime) / 1000).toFixed(2)}s for (${this.releaseTarget.id})`,
    );

    return result;
  }
  async findVersionsForEvaluate() {
    const startTime = performance.now();

    // Measure findLatestVersionMatchingPolicy
    const latestVersionStartTime = performance.now();
    const latestVersionMatchingPolicy =
      await this.findLatestVersionMatchingPolicy();
    const latestVersionEndTime = performance.now();

    log.info(
      `[time] findLatestVersionMatchingPolicy took ${((latestVersionEndTime - latestVersionStartTime) / 1000).toFixed(3)}s`,
    );

    // Measure findLastestDeployedVersion
    const latestDeployedStartTime = performance.now();
    const latestDeployedVersion = await this.findLastestDeployedVersion();
    const latestDeployedEndTime = performance.now();

    log.info(
      `[time] findLastestDeployedVersion took ${((latestDeployedEndTime - latestDeployedStartTime) / 1000).toFixed(3)}s`,
    );

    const versionsStartTime = performance.now();

    const policy = await this.getPolicy();
    const policyEndTime = performance.now();

    const queryStartTime = performance.now();
    const versions = await this.db.query.deploymentVersion.findMany({
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
      orderBy: desc(schema.deploymentVersion.createdAt),
      limit: 1_000,
      with: { metadata: true },
    });

    const queryEndTime = performance.now();

    const totalTime = queryEndTime - startTime;
    const steps = [
      {
        name: "getting latest versions",
        duration: versionsStartTime - startTime,
      },
      {
        name: "getting policy",
        duration: policyEndTime - versionsStartTime,
      },
      {
        name: "versions query",
        duration: queryEndTime - queryStartTime,
      },
    ];

    steps.forEach((step) => {
      const percentage = ((step.duration / totalTime) * 100).toFixed(1);
      log.info(
        `[time] ${step.name} took ${percentage}% (${(step.duration / 1000).toFixed(3)}s) of total time (id: ${this.releaseTarget.id})`,
      );
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
    if (!forceRefresh && this.cachedPolicy !== null) return this.cachedPolicy;

    const startTime = performance.now();
    const policies = await getApplicablePolicies(
      this.db,
      this.releaseTarget.workspaceId,
      this.releaseTarget,
    );
    const endTime = performance.now();
    log.info(
      `[time] getting applicable policies took ${((endTime - startTime) / 1000).toFixed(2)}s`,
    );

    this.cachedPolicy = mergePolicies(policies);
    return this.cachedPolicy;
  }

  async evaluate(options?: VersionEvaluateOptions) {
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
    const rules = (options?.rules ?? getRules)(policy);

    const filterRules = rules.filter(isFilterRule);
    const preValidationRules = rules.filter(isPreValidationRule);

    for (const rule of preValidationRules) {
      const startTime = performance.now();
      const result = rule.passing(ctx);
      const endTime = performance.now();

      const duration = (endTime - startTime) / 1000;
      if (duration > 1) {
        log.warn(
          `[time] pre validation rule ${rule.constructor.name} took ${duration.toFixed(2)}s`,
        );
      }

      if (!result.passing) {
        log.info("Pre-validation rule failed", {
          rule: rule.constructor.name,
          rejectionReason: result.rejectionReason,
        });
        return {
          chosenCandidate: null,
          rejectionReasons: new ConstantMap<string, string>(
            result.rejectionReason ?? "",
          ),
        };
      }
    }

    const engine = new VersionRuleEngine(filterRules);
    const versions =
      options?.versions ?? (await this.findVersionsForEvaluate());

    const bytes = sizeOf(versions);
    log.info(
      `Evaluating ${versions.length} versions (${this.releaseTarget.id})`,
      {
        size: formatBytes(bytes),
        bytes,
      },
    );
    const result = await engine.evaluate(ctx, versions);
    return result;
  }
}

/**
 * Formats a byte size into a human readable string with appropriate units.
 * Handles sizes from bytes up to terabytes.
 *
 * @param bytes - The number of bytes to format
 * @returns A formatted string like "1.5 MB" or "800 KB"
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  // Get appropriate unit by calculating log base 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Format with 2 decimal places and trim trailing zeros
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
