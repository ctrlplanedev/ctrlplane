"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";

import { api } from "~/trpc/react";

export const ApprovalDialog: React.FC<{
  release: { id: string; version: string; deploymentId: string };
  policyId: string;
  environmentId?: string;
  children: React.ReactNode;
}> = ({ release, policyId, environmentId, children }) => {
  const policyQ = api.environment.policy.byId.useQuery(policyId);

  const [open, setOpen] = useState(false);
  const approve = api.environment.policy.approval.approve.useMutation();
  const reject = api.environment.policy.approval.reject.useMutation();
  const utils = api.useUtils();
  const invalidateApproval = () => {
    utils.environment.policy.approval.statusByReleasePolicyId.invalidate({
      policyId,
      releaseId: release.id,
    });
    if (environmentId != null)
      utils.release.latest.byDeploymentAndEnvironment.invalidate({
        deploymentId: release.deploymentId,
        environmentId,
      });
  };
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Approve release <span className="truncate">{release.version}</span>
          </DialogTitle>
          {policyQ.isLoading && (
            <DialogDescription className="flex items-center justify-center">
              <IconLoader2 className="animate-spin" />
            </DialogDescription>
          )}
          {!policyQ.isLoading && (
            <DialogDescription>
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
            </DialogDescription>
          )}
        </DialogHeader>
        {!policyQ.isLoading && (
          <DialogFooter className="flex w-full justify-between sm:flex-row sm:justify-between">
            <DialogClose>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={onReject}>
                Reject
              </Button>
              <Button onClick={onApprove}>Approve</Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
