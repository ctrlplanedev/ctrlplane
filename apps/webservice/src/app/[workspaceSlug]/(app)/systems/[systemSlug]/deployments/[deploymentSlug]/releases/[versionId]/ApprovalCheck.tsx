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

import { api } from "~/trpc/react";
import { Cancelled, Failing, Loading, Passing, Waiting } from "./StatusIcons";

const ApprovalDialog: React.FC<{
  releaseId: string;
  environmentId: string;
  children: React.ReactNode;
}> = ({ releaseId, environmentId, children }) => {
  const approve = api.environment.approval.approve.useMutation();
  const rejected = api.environment.approval.reject.useMutation();
  const onApprove = () =>
    approve
      .mutateAsync({ releaseId, environmentId })
      .then(() => router.refresh());
  const onReject = () =>
    rejected
      .mutateAsync({ releaseId, environmentId })
      .then(() => router.refresh());
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approval</AlertDialogTitle>
          <AlertDialogDescription>
            Approving this action will initiate the deployment of the release to
            all currently linked environments.
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
  environmentId: string;
  releaseId: string;
}> = ({ environmentId, releaseId }) => {
  const approvalStatus =
    api.environment.approval.statusByReleaseEnvironmentId.useQuery({
      environmentId,
      releaseId,
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
    <ApprovalDialog environmentId={environmentId} releaseId={releaseId}>
      <button
        disabled={status === "approved" || status === "rejected"}
        className="flex w-full items-center gap-2 rounded-md hover:bg-neutral-800/50"
      >
        {status === "approved" ? (
          <>
            <Passing /> Approved
          </>
        ) : status === "rejected" ? (
          <>
            <Failing /> Rejected
          </>
        ) : (
          <>
            <Waiting /> Pending approval
          </>
        )}
      </button>
    </ApprovalDialog>
  );
};
