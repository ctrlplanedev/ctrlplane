"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

export const ApprovalDialog: React.FC<{
  versionId: string;
  versionTag: string;
  environmentId: string;
  children: React.ReactNode;
  onSubmit?: () => void;
}> = ({ versionId, versionTag, environmentId, children, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const addRecord = api.deployment.version.addApprovalRecord.useMutation();

  const router = useRouter();

  const [reason, setReason] = useState("");

  const handleSubmit = (status: SCHEMA.ApprovalStatus) =>
    addRecord
      .mutateAsync({
        deploymentVersionId: versionId,
        environmentId,
        status,
        reason,
      })
      .then(() => setOpen(false))
      .then(() => onSubmit?.())
      .then(() => router.refresh());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Release</DialogTitle>
          <DialogDescription>
            Are you sure you want to approve version {versionTag}?
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for approval (optional)"
        />

        <DialogFooter className="flex w-full flex-row items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit(SCHEMA.ApprovalStatus.Rejected)}
              disabled={addRecord.isPending}
            >
              Reject
            </Button>
            <Button
              onClick={() => handleSubmit(SCHEMA.ApprovalStatus.Approved)}
              disabled={addRecord.isPending}
            >
              Approve
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
