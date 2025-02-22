"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";

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

import { api } from "~/trpc/react";

export const ApprovalDialog: React.FC<{
  release: { id: string; version: string };
  policyId: string;
  children: React.ReactNode;
}> = ({ release, policyId, children }) => {
  const policyQ = api.environment.policy.byId.useQuery(policyId);

  const [open, setOpen] = useState(false);
  const approve = api.environment.policy.approval.approve.useMutation();
  const reject = api.environment.policy.approval.reject.useMutation();
  const utils = api.useUtils();
  const invalidateApproval = () =>
    utils.environment.policy.approval.statusByReleasePolicyId.invalidate({
      policyId,
      releaseId: release.id,
    });
  const releaseId = release.id;
  const onApprove = () =>
    approve
      .mutateAsync({ releaseId, policyId })
      .then(() => router.refresh())
      .then(() => invalidateApproval())
      .then(() => setOpen(false));
  const onReject = () =>
    reject
      .mutateAsync({ releaseId, policyId })
      .then(() => router.refresh())
      .then(() => invalidateApproval())
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
          {policyQ.isLoading && (
            <AlertDialogDescription className="flex items-center justify-center">
              <IconLoader2 className="animate-spin" />
            </AlertDialogDescription>
          )}
          {!policyQ.isLoading && (
            <AlertDialogDescription>
              <div className="flex flex-col gap-2">
                Approves this release for the following environments:
                <div className="flex flex-wrap gap-2">
                  {policyQ.data?.environments.map((env) => (
                    <Badge
                      key={env.id}
                      variant="secondary"
                      className="max-w-40"
                    >
                      <span className="truncate">{env.name}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {!policyQ.isLoading && (
          <AlertDialogFooter className="flex w-full justify-between sm:flex-row sm:justify-between">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <div className="flex gap-2">
              <AlertDialogCancel onClick={onReject}>Reject</AlertDialogCancel>
              <AlertDialogAction onClick={onApprove}>Approve</AlertDialogAction>
            </div>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
