"use client";

import type {
  Environment,
  EnvironmentPolicyApproval,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

type PolicyApprovalRowProps = {
  approval: EnvironmentPolicyApproval;
  environments: Environment[];
};

export const PolicyApprovalRow: React.FC<PolicyApprovalRowProps> = ({
  approval,
  environments,
}) => {
  const router = useRouter();
  const utils = api.useUtils();

  const { releaseId, policyId } = approval;

  const rejectMutation = api.environment.policy.approval.reject.useMutation({
    onSuccess: ({ cancelledJobCount }) => {
      router.refresh();
      utils.environment.policy.invalidate();
      utils.job.config.invalidate();
      toast.success(
        `Rejected release to ${environmentNames} and cancelled ${cancelledJobCount} job${cancelledJobCount !== 1 ? "s" : ""}`,
      );
    },
    onError: () => toast.error("Error rejecting release"),
  });

  const approveMutation = api.environment.policy.approval.approve.useMutation({
    onSuccess: () => {
      router.refresh();
      utils.environment.policy.invalidate();
      utils.job.config.invalidate();
      toast.success(`Approved release to ${environmentNames}`);
    },
    onError: () => toast.error("Error approving release"),
  });

  const environmentNames = environments.map((e) => e.name).join(", ");
  const handleReject = () => rejectMutation.mutate({ releaseId, policyId });
  const handleApprove = () => approveMutation.mutate(approval);

  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-400/50 bg-blue-500/10 p-2 text-sm">
      <div className="ml-2 flex-grow">
        Approve deploying to {environmentNames}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleReject}>
          {"Reject"}
        </Button>
        <Button size="sm" onClick={handleApprove}>
          {"Approve"}
        </Button>
      </div>
    </div>
  );
};
