"use client";

import type {
  Environment,
  EnvironmentPolicyApproval,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type PolicyApprovalRowProps = {
  approval: EnvironmentPolicyApproval;
  environments: Environment[];
  release: { id: string; version: string };
};

export const PolicyApprovalRow: React.FC<PolicyApprovalRowProps> = ({
  approval,
  environments,
  release,
}) => {
  const router = useRouter();
  const utils = api.useUtils();

  const rejectMutation = api.environment.policy.approval.reject.useMutation();
  const approveMutation = api.environment.policy.approval.approve.useMutation();
  const updateJob = api.job.update.useMutation();

  const { data: jobTriggers } = api.job.config.byReleaseId.useQuery(
    release.id,
    { refetchInterval: 5000 },
  );

  const jobIds =
    jobTriggers
      ?.filter((trigger) =>
        environments.some((env) => trigger.environmentId === env.id),
      )
      .map((trigger) => trigger.job.id) ?? [];

  const environmentNames = environments.map((e) => e.name).join(", ");

  const handleReject = () => {
    Promise.all(
      jobIds.map((jobId) =>
        updateJob.mutateAsync({
          id: jobId,
          data: { status: JobStatus.Cancelled },
        }),
      ),
    )
      .then(() => rejectMutation.mutateAsync(approval))
      .then(() => {
        router.refresh();
        utils.environment.policy.invalidate();
        utils.job.config.invalidate();
        toast.success(`Rejected release to ${environmentNames}`);
      })
      .catch(() => toast.error("Error rejecting release"));
  };

  const handleApprove = () =>
    approveMutation
      .mutateAsync(approval)
      .then(() => {
        router.refresh();
        utils.environment.policy.invalidate();
        utils.job.config.invalidate();
        toast.success(`Approved release to ${environmentNames}`);
      })
      .catch(() => toast.error("Error approving release"));

  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-400/50 bg-blue-500/10 p-2 text-sm">
      <div className="ml-2 flex-grow">
        Approve deploying to {environmentNames}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleReject}>
          Reject
        </Button>
        <Button size="sm" onClick={handleApprove}>
          Approve
        </Button>
      </div>
    </div>
  );
};
