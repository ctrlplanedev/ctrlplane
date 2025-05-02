import _ from "lodash";

import { inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Version } from "../manager/version-rule-engine.js";
import type { FilterRule, RuleEngineRuleResult } from "../types.js";

type Record = {
  versionId: string;
  status: "approved" | "rejected";
  userId: string;
  reason: string | null;
};

export type GetApprovalRecordsFunc = (
  versionIds: string[],
) => Promise<Record[]>;

type VersionApprovalRuleOptions = {
  minApprovals: number;

  getApprovalRecords: GetApprovalRecordsFunc;
};

export class VersionApprovalRule implements FilterRule<Version> {
  public readonly name = "VersionApprovalRule";

  constructor(private readonly options: VersionApprovalRuleOptions) {}

  async filter(candidates: Version[]): Promise<RuleEngineRuleResult<Version>> {
    const rejectionReasons = new Map<string, string>();
    const versionIds = _(candidates)
      .map((r) => r.id)
      .uniq()
      .value();
    const approvalRecords = await this.options.getApprovalRecords(versionIds);

    const allowedCandidates = candidates.filter((release) => {
      const records = approvalRecords.filter((r) => r.versionId === release.id);

      const approvals = records.filter((r) => r.status === "approved");
      const rejections = records.filter((r) => r.status === "rejected");

      if (rejections.length > 0) {
        rejectionReasons.set(
          release.id,
          `Has been rejected by ${rejections.length} users.`,
        );
        return false;
      }

      const meetsMinApprovals = approvals.length >= this.options.minApprovals;
      if (!meetsMinApprovals)
        rejectionReasons.set(
          release.id,
          `Missing ${this.options.minApprovals - approvals.length} approvals.`,
        );
      return meetsMinApprovals;
    });

    return { allowedCandidates, rejectionReasons };
  }
}

export const getAnyApprovalRecords: GetApprovalRecordsFunc = async (
  versionIds: string[],
) => {
  const records = await db.query.policyRuleAnyApprovalRecord.findMany({
    where: inArray(
      schema.policyRuleAnyApprovalRecord.deploymentVersionId,
      versionIds,
    ),
  });
  return records.map((record) => ({
    ...record,
    versionId: record.deploymentVersionId,
  }));
};

export const getRoleApprovalRecords: GetApprovalRecordsFunc = async (
  versionIds: string[],
) => {
  const records = await db.query.policyRuleRoleApprovalRecord.findMany({
    where: inArray(
      schema.policyRuleRoleApprovalRecord.deploymentVersionId,
      versionIds,
    ),
  });
  return records.map((record) => ({
    ...record,
    versionId: record.deploymentVersionId,
  }));
};

export const getUserApprovalRecords: GetApprovalRecordsFunc = async (
  versionIds: string[],
) => {
  const records = await db.query.policyRuleUserApprovalRecord.findMany({
    where: inArray(
      schema.policyRuleUserApprovalRecord.deploymentVersionId,
      versionIds,
    ),
  });
  return records.map((record) => ({
    ...record,
    versionId: record.deploymentVersionId,
  }));
};
