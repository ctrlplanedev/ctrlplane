import _ from "lodash";

import { inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Releases } from "../releases.js";
import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";

type Record = {
  versionId: string;
  status: "approved" | "rejected";
  userId: string;
  reason: string | null;
};

type GetApprovalRecordsFunc = (
  context: DeploymentResourceContext,
  versionIds: string[],
) => Promise<Record[]>;

type VersionApprovalRuleOptions = {
  minApprovals: number;

  getApprovalRecords: GetApprovalRecordsFunc;
};

export class VersionApprovalRule implements DeploymentResourceRule {
  public readonly name = "VersionApprovalRule";

  constructor(private readonly options: VersionApprovalRuleOptions) {}

  async filter(
    context: DeploymentResourceContext,
    releases: Releases,
  ): Promise<DeploymentResourceRuleResult> {
    const rejectionReasons = new Map<string, string>();
    const versionIds = _(releases.getAll())
      .map((r) => r.version.id)
      .uniq()
      .value();
    const approvalRecords = await this.options.getApprovalRecords(
      context,
      versionIds,
    );

    const allowedReleases = releases.filter((release) => {
      const records = approvalRecords.filter(
        (r) => r.versionId === release.version.id,
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

    return { allowedReleases, rejectionReasons };
  }
}

export const getAnyApprovalRecords: GetApprovalRecordsFunc = async (
  _: DeploymentResourceContext,
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
  _: DeploymentResourceContext,
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
  _: DeploymentResourceContext,
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
