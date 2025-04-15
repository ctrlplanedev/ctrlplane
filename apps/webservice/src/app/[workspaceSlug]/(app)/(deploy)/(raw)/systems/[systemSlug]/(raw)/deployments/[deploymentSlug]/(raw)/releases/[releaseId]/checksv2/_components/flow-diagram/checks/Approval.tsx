import { useState } from "react";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { Loading, Passing, Waiting } from "../StatusIcons";

const ApprovalDialog: React.FC<{
  versionId: string;
  versionTag: string;
  environmentId: string;
  onSubmit: () => void;
}> = ({ versionId, versionTag, environmentId, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const addRecord =
    api.deployment.version.checks.approval.addRecord.useMutation();

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
      .then(() => onSubmit());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-6">
          Approve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>Approve Release</DialogHeader>
        <DialogDescription>
          Are you sure you want to approve version {versionTag}?
        </DialogDescription>

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

export const ApprovalCheck: React.FC<{
  workspaceId: string;
  environmentId: string;
  versionId: string;
  versionTag: string;
}> = (props) => {
  const { data, isLoading } =
    api.deployment.version.checks.approval.status.useQuery(props);
  const utils = api.useUtils();
  const invalidate = () =>
    utils.deployment.version.checks.approval.status.invalidate(props);

  const isApproved = data?.approved ?? false;
  const rejectionReasonEntries = Array.from(
    data?.rejectionReasons.entries() ?? [],
  );

  if (isLoading)
    return (
      <div className="flex items-center gap-2">
        <Loading /> Loading approval status
      </div>
    );

  if (isApproved)
    return (
      <div className="flex items-center gap-2">
        <Passing /> Approved
      </div>
    );

  if (rejectionReasonEntries.length > 0)
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waiting /> Not enough approvals
              </div>
              <ApprovalDialog {...props} onSubmit={invalidate} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <ul>
              {rejectionReasonEntries.map(([reason, comment]) => (
                <li key={reason}>
                  {reason}: {comment}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Waiting /> Not enough approvals
      </div>
      <ApprovalDialog {...props} onSubmit={invalidate} />
    </div>
  );
};
