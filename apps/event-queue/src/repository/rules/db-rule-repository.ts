import type { Tx } from "@ctrlplane/db";
import type {
  FilterRule,
  PreValidationRule,
  Version,
} from "@ctrlplane/rule-engine";

import { allRules, eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  getConcurrencyRule,
  getEnvironmentVersionRolloutRule,
  getVersionApprovalRules,
  getVersionDependencyRule,
  ReleaseTargetConcurrencyRule,
  ReleaseTargetLockRule,
} from "@ctrlplane/rule-engine";

import type { VersionRuleRepository } from "./repository";

export class DbVersionRuleRepository implements VersionRuleRepository {
  private readonly workspaceId: string;
  private db: Tx;
  constructor(workspaceId: string, tx?: Tx) {
    this.workspaceId = workspaceId;
    this.db = tx ?? dbClient;
  }

  async getRules(
    policyId: string,
    releaseTargetId: string,
  ): Promise<(FilterRule<Version> | PreValidationRule)[]> {
    const policy =
      (await this.db.query.policy.findFirst({
        where: eq(schema.policy.id, policyId),
        with: allRules,
      })) ?? null;

    const environmentVersionRolloutRule =
      await getEnvironmentVersionRolloutRule(policy, releaseTargetId);
    const versionApprovalRules = await getVersionApprovalRules(
      policy,
      releaseTargetId,
    );
    const versionDependencyRule =
      await getVersionDependencyRule(releaseTargetId);
    const concurrencyRule = getConcurrencyRule(policy);
    const lockRule = new ReleaseTargetLockRule({ releaseTargetId });
    const releaseTargetConcurrencyRule = new ReleaseTargetConcurrencyRule(
      releaseTargetId,
    );

    return [
      ...(environmentVersionRolloutRule ? [environmentVersionRolloutRule] : []),
      ...versionApprovalRules,
      versionDependencyRule,
      ...concurrencyRule,
      lockRule,
      releaseTargetConcurrencyRule,
    ];
  }
}
