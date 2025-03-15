import type * as SCHEMA from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import { useEffect, useState } from "react";
import { differenceInMilliseconds } from "date-fns";
import prettyMilliseconds from "pretty-ms";
import { Handle, Position } from "reactflow";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";
import { ApprovalCheck } from "./ApprovalCheck";
import { Cancelled, Loading, Passing, Waiting } from "./StatusIcons";

type PolicyNodeProps = NodeProps<
  SCHEMA.EnvironmentPolicy & {
    release: SCHEMA.DeploymentVersion;
    policyDeployments: Array<SCHEMA.EnvironmentPolicyDeployment>;
  }
>;

const MinSuccessCheck: React.FC<PolicyNodeProps["data"]> = ({
  successMinimum,
  successType,
  release,
  policyDeployments,
}) => {
  const allJobs = api.job.config.byReleaseId.useQuery(
    { releaseId: release.id },
    { refetchInterval: 10_000 },
  );
  const envIds = policyDeployments.map((p) => p.environmentId);
  const jobs = allJobs.data?.filter((j) => envIds.includes(j.environmentId));

  if (successType === "optional") return null;

  if (successType === "some") {
    const passing =
      jobs?.filter((job) => job.job.status === JobStatus.Successful).length ??
      0;

    const isMinSatified = passing >= successMinimum;
    return (
      <div className="flex items-center gap-2">
        {isMinSatified ? <Passing /> : <Waiting />} &ge; {successMinimum}{" "}
        completed sucessfully
      </div>
    );
  }

  const areAllSuccessful =
    jobs?.every((job) => job.job.status === JobStatus.Successful) ?? true;

  return (
    <div className="flex items-center gap-2">
      {areAllSuccessful ? (
        <>
          <Passing /> All jobs successful
        </>
      ) : (
        <>
          <Waiting /> Waiting for all jobs to complete
        </>
      )}
    </div>
  );
};

const GradualRolloutCheck: React.FC<PolicyNodeProps["data"]> = (data) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { data: approvalStatus, isLoading } =
    api.environment.policy.approval.statusByReleasePolicyId.useQuery(
      { policyId: data.id, releaseId: data.release.id },
      { enabled: data.approvalRequirement === "manual" },
    );

  const startDate =
    data.approvalRequirement === "manual"
      ? (approvalStatus?.approvedAt ?? data.release.createdAt)
      : data.release.createdAt;

  useEffect(() => {
    const calculateTimeLeft = () => {
      const timePassed = differenceInMilliseconds(new Date(), startDate);
      return Math.max(0, data.rolloutDuration - timePassed);
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [startDate, data.rolloutDuration]);

  if (timeLeft == null) return null;

  if (isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading rollout status
      </div>
    );

  const isApprovalPending =
    approvalStatus == null || approvalStatus.status === "pending";

  if (data.approvalRequirement === "manual" && isApprovalPending)
    return (
      <div className="flex items-center gap-2">
        <Waiting /> Rollout pending approval
      </div>
    );

  if (
    data.approvalRequirement === "manual" &&
    approvalStatus?.status === "rejected"
  )
    return (
      <div className="flex items-center gap-2">
        <Cancelled /> Rollout skipped due to approval rejection
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      {timeLeft <= 0 ? <Passing /> : <Waiting />}{" "}
      {timeLeft <= 0 ? (
        "Rollout completed"
      ) : (
        <>
          Rollout completes in{" "}
          {prettyMilliseconds(timeLeft, {
            compact: true,
            keepDecimalsOnWholeSeconds: false,
          })}
        </>
      )}
    </div>
  );
};

export const PolicyNode: React.FC<PolicyNodeProps> = ({ data }) => {
  const noMinSuccess = data.successType === "optional";
  const noRollout = data.rolloutDuration === 0;
  const noApproval = data.approvalRequirement === "automatic";

  return (
    <>
      <div
        className={cn(
          "relative w-[250px] space-y-1 rounded-md border px-2 py-1.5 text-sm",
        )}
      >
        {!noMinSuccess && <MinSuccessCheck {...data} />}
        {!noRollout && <GradualRolloutCheck {...data} />}
        {!noApproval && (
          <ApprovalCheck policyId={data.id} release={data.release} />
        )}

        {noMinSuccess && noRollout && noApproval && (
          <div className="text-muted-foreground">No policy checks.</div>
        )}
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Right}
      />
    </>
  );
};
