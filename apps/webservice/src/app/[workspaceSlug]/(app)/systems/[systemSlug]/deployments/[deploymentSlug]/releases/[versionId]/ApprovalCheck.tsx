import type { Environment } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { Cancelled, Failing, Loading, Passing, Waiting } from "./StatusIcons";

export const ApprovalDialog: React.FC<{
  release: { id: string; version: string };
  policyId: string;
  linkedEnvironments: Array<Environment>;
  children: React.ReactNode;
}> = ({ release, policyId, linkedEnvironments, children }) => {
  const [open, setOpen] = useState(false);
  const approve = api.environment.policy.approval.approve.useMutation();
  const reject = api.environment.policy.approval.reject.useMutation();
  const releaseId = release.id;
  const onApprove = () =>
    approve
      .mutateAsync({ releaseId, policyId })
      .then(() => router.refresh())
      .then(() => setOpen(false));
  const onReject = () =>
    reject
      .mutateAsync({ releaseId, policyId })
      .then(() => router.refresh())
      .then(() => setOpen(false));
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold">
            Approve release <span className="truncate">{release.version}</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="flex flex-col gap-2">
              Approves this release for the following environments:
              <div className="flex flex-wrap gap-2">
                {linkedEnvironments.map((env) => (
                  <Badge
                    key={env.id}
                    variant="secondary"
                    className="max-w-24 truncate"
                  >
                    {env.name}
                  </Badge>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Reject</AlertDialogCancel>
          <AlertDialogAction onClick={onApprove}>Approve</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const ApprovalCheck: React.FC<{
  policyId: string;
  release: { id: string; version: string };
  linkedEnvironments: Array<Environment>;
}> = ({ policyId, release, linkedEnvironments }) => {
  const approvalStatus =
    api.environment.policy.approval.statusByReleasePolicyId.useQuery({
      policyId,
      releaseId: release.id,
    });

  if (approvalStatus.isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading approval status
      </div>
    );

  if (approvalStatus.data == null)
    return (
      <div className="flex items-center gap-2">
        <Cancelled /> Approval skipped
      </div>
    );

  const status = approvalStatus.data.status;
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {status === "approved" && (
          <>
            <Passing /> Approved
          </>
        )}
        {status === "rejected" && (
          <>
            <Failing /> Rejected
          </>
        )}
        {status === "pending" && (
          <>
            <Waiting /> Pending approval
          </>
        )}
      </div>

      {status === "pending" && (
        <ApprovalDialog
          policyId={policyId}
          release={release}
          linkedEnvironments={linkedEnvironments}
        >
          <Button size="sm" className="h-6 px-2 py-1">
            Review
          </Button>
        </ApprovalDialog>
      )}
    </div>
  );
};
