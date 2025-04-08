import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { desc, eq, takeFirst } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Policy, RuleEngineContext } from "../types.js";
import type { ReleaseManager, ReleaseTarget } from "./types.js";
import { getApplicablePolicies } from "../db/get-applicable-policies.js";
import { VersionRuleEngine } from "../manager/version-rule-engine.js";
import { mergePolicies } from "../utils/merge-policies.js";
import { getRules } from "./version-manager-rules.js";

export class VersionReleaseManager implements ReleaseManager {
  private cachedPolicy: Policy | null = null;
  private constructor(
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

  async findLatestRelease() {
    return this.db.query.versionRelease.findFirst({
      where: eq(schema.versionRelease.releaseTargetId, this.releaseTarget.id),
      orderBy: desc(schema.versionRelease.createdAt),
    });
  }

  async getPolicy(forceRefresh = false): Promise<Policy | null> {
    // Return cached policy if available and refresh not forced
    if (!forceRefresh && this.cachedPolicy !== null) {
      return this.cachedPolicy;
    }

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
    const result = await engine.evaluate(ctx, []);
    return result;
  }
}
