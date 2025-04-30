import _ from "lodash";

import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Version } from "../manager/version-rule-engine.js";
import type {
  FilterRule,
  RuleEngineContext,
  RuleEngineRuleResult,
} from "../types.js";

type Record = {
  deploymentVersionId: string;
  status: "approved" | "rejected";
  userId: string;
  reason: string | null;
};

export type GetApprovalRecordsFunc = (
  context: RuleEngineContext,
  deploymentVersionIds: string[],
) => Promise<Record[]>;

type VersionApprovalRuleOptions = {
  minApprovals: number;

  getApprovalRecords: GetApprovalRecordsFunc;
};

export class VersionApprovalRule implements FilterRule<Version> {
  public readonly name = "VersionApprovalRule";

  constructor(private readonly options: VersionApprovalRuleOptions) {}

  async filter(
    context: RuleEngineContext,
    candidates: Version[],
  ): Promise<RuleEngineRuleResult<Version>> {
    const rejectionReasons = new Map<string, string>();
    const deploymentVersionIds = _(candidates)
      .map((r) => r.id)
      .uniq()
      .value();
    const approvalRecords = await this.options.getApprovalRecords(
      context,
      deploymentVersionIds,
    );

    const allowedCandidates = candidates.filter((release) => {
      const records = approvalRecords.filter(
        (r) => r.deploymentVersionId === release.id,
      );

      const approvals = records.filter((r) => r.status === "approved");
      const rejections = records.filter((r) => r.status === "rejected");

      if (rejections.length > 0) {
        rejectionReasons.set(
          release.id,
          `Has been rejected by ${rejections.length} users.`,
        );
        return false;
      }

      return approvals.length >= this.options.minApprovals;
    });

    return { allowedCandidates, rejectionReasons };
  }
}

export const getAnyApprovalRecords: GetApprovalRecordsFunc = async (
  _: RuleEngineContext,
  deploymentVersionIds: string[],
) =>
  db.query.deploymentVersionApprovalRecord.findMany({
    where: inArray(
      schema.deploymentVersionApprovalRecord.deploymentVersionId,
      deploymentVersionIds,
    ),
  });

export const getRoleApprovalRecordsFunc =
  (roleId: string): GetApprovalRecordsFunc =>
  async (_, versionIds) => {
    const recordResults = await db
      .select()
      .from(schema.deploymentVersionApprovalRecord)
      .innerJoin(
        schema.entityRole,
        eq(
          schema.entityRole.entityId,
          schema.deploymentVersionApprovalRecord.userId,
        ),
      )
      .where(
        and(
          inArray(
            schema.deploymentVersionApprovalRecord.deploymentVersionId,
            versionIds,
          ),
          eq(schema.entityRole.entityType, schema.EntityTypeEnum.User),
          eq(schema.entityRole.roleId, roleId),
        ),
      );

    return recordResults.map(
      (record) => record.deployment_version_approval_record,
    );
  };

export const getUserApprovalRecordsFunc =
  (userId: string): GetApprovalRecordsFunc =>
  async (_, versionIds) =>
    db.query.deploymentVersionApprovalRecord.findMany({
      where: and(
        inArray(
          schema.deploymentVersionApprovalRecord.deploymentVersionId,
          versionIds,
        ),
        eq(schema.deploymentVersionApprovalRecord.userId, userId),
      ),
    });
