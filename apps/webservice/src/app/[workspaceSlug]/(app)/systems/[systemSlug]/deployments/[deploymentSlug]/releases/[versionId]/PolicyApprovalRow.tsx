"use client";

import type {
  Environment,
  EnvironmentApproval,
  User,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

type EnvironmentApprovalRowProps = {
  approval: EnvironmentApproval & { user?: User | null };
  environment?: Environment;
};

export const EnvironmentApprovalRow: React.FC<EnvironmentApprovalRowProps> = ({
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
  const { releaseId, environmentId, status } = approval;

  const rejectMutation = api.environment.approval.reject.useMutation({
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

  const approveMutation = api.environment.approval.approve.useMutation({
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
      environmentId,
    });
  const handleApprove = () =>
    approveMutation.mutate({
      releaseId,
      environmentId,
    });

  return (
    <div className="flex items-center gap-2 rounded-md text-sm">
      {status === "pending" ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
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
