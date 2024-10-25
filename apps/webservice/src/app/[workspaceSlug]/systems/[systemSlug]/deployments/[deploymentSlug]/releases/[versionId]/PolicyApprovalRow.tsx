"use client";

import type {
  Environment,
  EnvironmentPolicyApproval,
  User,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { logger } from "@ctrlplane/logger";
import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

type PolicyApprovalRowProps = {
  approval: EnvironmentPolicyApproval & { user?: User };
  environment: Environment | undefined;
};

export const PolicyApprovalRow: React.FC<PolicyApprovalRowProps> = ({
  approval,
  environment,
}) => {
  const router = useRouter();
  const utils = api.useUtils();

  if (!environment) {
    logger.error("Environment is undefined for approval:", approval);
    return null;
  }

  const environmentName = environment.name;
  const { releaseId, policyId, status } = approval;
  const currentUserID = api.user.viewer.useQuery().data?.id;

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
      userId: currentUserID!,
    });
  const handleApprove = () =>
    approveMutation.mutate({
      releaseId,
      policyId,
      userId: currentUserID!,
    });

  console.log("status", status);

  const renderStatusContent = () => {
    if (status === "pending") {
      return (
        <>
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
        </>
      );
    }

    if (status === "approved")
      return (
        <div className="ml-2 flex-grow">
          <span className="font-medium text-white">
            Approved by {approval.user?.name}
          </span>
        </div>
      );

    return (
      <div className="ml-2 flex-grow">
        <span className="font-medium text-muted-foreground">
          Rejected by {approval.user?.name}
        </span>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 rounded-md text-sm">
      {renderStatusContent()}
    </div>
  );
};
