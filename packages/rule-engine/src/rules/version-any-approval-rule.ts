import type { Releases } from "../releases.js";
import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  ResolvedRelease,
} from "../types.js";

type Record = {
  status: "approved" | "rejected";
  userId: string;
  reason: string;
  approvedAt: Date;
};

type VersionAnyApprovalRuleOptions = {
  minApprovals: number;

  getApprovalRecords: (
    context: DeploymentResourceContext,
    release: ResolvedRelease,
  ) => Promise<Record[]>;
};

export class VersionAnyApprovalRule implements DeploymentResourceRule {
  public readonly name = "VersionAnyApprovalRule";

  constructor(private readonly options: VersionAnyApprovalRuleOptions) {}

  async filter(
    context: DeploymentResourceContext,
    releases: Releases,
  ): Promise<DeploymentResourceRuleResult> {
    const rejectionReasons = new Map<string, string>();
    const approvalRecords = await Promise.all(
      releases.map((release) =>
        this.options.getApprovalRecords(context, release).then((records) => ({
          release,
          records,
        })),
      ),
    );

    const allowedReleases = releases.filter((release) => {
      const records =
        approvalRecords.find((r) => r.release.id === release.id)?.records ?? [];

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
