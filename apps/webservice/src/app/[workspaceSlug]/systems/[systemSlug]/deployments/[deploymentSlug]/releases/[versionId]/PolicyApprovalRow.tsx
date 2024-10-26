"use client";

import type {
  Environment,
  EnvironmentPolicyApproval,
  User,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

type PolicyApprovalRowProps = {
  approval: EnvironmentPolicyApproval & { user?: User | null };
  environment: Environment | undefined;
};

export const PolicyApprovalRow: React.FC<PolicyApprovalRowProps> = ({
  approval,
  environment,
}) => {
  const router = useRouter();
  const utils = api.useUtils();

  if (!environment) {
    console.error("Environment is undefined for approval:", approval);
    return null;
  }

  const environmentName = environment.name;
  const { releaseId, policyId, status } = approval;
  const currentUserId = api.user.viewer.useQuery().data?.id;

  const rejectMutation = api.environment.policy.approval.reject.useMutation({
    onSuccess: ({ cancelledJobCount }) => {
      router.refresh();
      utils.environment.policy.invalidate();
      utils.job.config.invalidate();
      toast.success(
        `Rejected release to ${environmentName} and cancelled ${cancelledJobCount} job${cancelledJobCount !== 1 ? "s" : ""}`,
      );
    },
    onError: () => toast.error("Error rejecting release"),
  });

  const approveMutation = api.environment.policy.approval.approve.useMutation({
    onSuccess: () => {
      router.refresh();
      utils.environment.policy.invalidate();
      utils.job.config.invalidate();
      toast.success(`Approved release to ${environmentName}`);
    },
    onError: () => toast.error("Error approving release"),
  });

  const handleReject = () =>
    rejectMutation.mutate({
      releaseId,
      policyId,
      userId: currentUserId!,
    });
  const handleApprove = () =>
    approveMutation.mutate({
      releaseId,
      policyId,
      userId: currentUserId!,
    });

  return (
    <div className="flex items-center gap-2 rounded-md text-sm">
      {status === "pending" ? (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            className="h-6 px-2"
            onClick={handleReject}
          >
            Reject
          </Button>
          <Button className="h-6 px-2" onClick={handleApprove}>
            Approve
          </Button>
        </div>
      ) : (
        <div className="ml-2 flex-grow">
          <span className="font-medium">
            {status === "approved" ? (
              <span className="text-green-300">Approved</span>
            ) : (
              <span className="text-red-300">Rejected</span>
            )}{" "}
            by {approval.user?.name}
          </span>
        </div>
      )}
    </div>
  );
};
