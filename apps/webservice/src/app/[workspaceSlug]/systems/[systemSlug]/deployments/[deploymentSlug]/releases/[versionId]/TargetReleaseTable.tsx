"use client";

import React, { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle, IconDots, IconLoader2 } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
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
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { JobTableStatusIcon } from "../../../../../../_components/JobTableStatusIcon";

const ForceReleaseTargetDialog: React.FC<{
  release: { id: string; version: string };
  target: { id: string; name: string };
  deploymentName: string;
  environmentId: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({
  release,
  deploymentName,
  target,
  environmentId,
  onClose,
  children,
}) => {
  const forceRelease = api.release.deploy.toTarget.useMutation();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to force release?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span>
              This will force <Badge variant="secondary">{target.name}</Badge>{" "}
              onto{" "}
              <strong>
                {deploymentName} {release.version}
              </strong>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex justify-end gap-2">
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={forceRelease.isPending}
            onClick={() =>
              forceRelease
                .mutateAsync({
                  releaseId: release.id,
                  targetId: target.id,
                  environmentId: environmentId,
                  isForcedRelease: true,
                })
                .then(() => {
                  router.refresh();
                  setOpen(false);
                  onClose();
                })
            }
          >
            Force Release
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const validForceReleaseJobStatus = [
  "scheduled",
  "action_required",
  "skipped",
  "failed",
  "cancelled",
  "completed",
];

const TargetDropdownMenu: React.FC<{
  release: { id: string; version: string };
  environmentId: string | null;
  target: { id: string; name: string; lockedAt: Date | null } | null;
  deploymentName: string;
  jobStatus: string;
}> = ({ release, deploymentName, target, environmentId, jobStatus }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <IconDots size={16} />
        </Button>
      </DropdownMenuTrigger>
      {target != null && (
        <DropdownMenuContent align="end">
          {target.lockedAt == null &&
            environmentId != null &&
            validForceReleaseJobStatus.includes(jobStatus) && (
              <ForceReleaseTargetDialog
                release={release}
                deploymentName={deploymentName}
                target={target}
                environmentId={environmentId}
                onClose={() => setOpen(false)}
              >
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="space-x-2"
                >
                  <IconAlertTriangle size={16} />
                  <p>Force Release</p>
                </DropdownMenuItem>
              </ForceReleaseTargetDialog>
            )}

          {target.lockedAt == null &&
            environmentId != null &&
            !validForceReleaseJobStatus.includes(jobStatus) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem disabled className="space-x-2">
                        <IconAlertTriangle size={16} />
                        <p>Force Release</p>
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Cannot force release while job is active
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          {target.lockedAt != null && environmentId != null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DropdownMenuItem disabled className="space-x-2">
                      <IconAlertTriangle size={16} />
                      <p>Force Release</p>
                    </DropdownMenuItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Cannot force release while target is locked
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};

type TargetReleaseTableProps = {
  release: { id: string; version: string };
  deploymentName: string;
};

export const TargetReleaseTable: React.FC<TargetReleaseTableProps> = ({
  release,
  deploymentName,
}) => {
  const releaseJobTriggerQuery = api.job.config.byReleaseId.useQuery(
    release.id,
    {
      refetchInterval: 5_000,
    },
  );

  if (releaseJobTriggerQuery.isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        <IconLoader2 className="animate-spin" size={32} />
      </div>
    );

  return (
    <Table>
      <TableBody>
        {_.chain(releaseJobTriggerQuery.data)
          .groupBy((r) => r.environmentId)
          .entries()
          .map(([envId, jobs]) => (
            <Fragment key={envId}>
              <TableRow className={cn("sticky bg-neutral-800/40")}>
                <TableCell colSpan={4}>
                  {jobs[0]?.environment != null && (
                    <div className="flex items-center gap-4">
                      <div className="flex-grow">
                        {jobs[0].environment.name}
                      </div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
              {jobs.map((job, idx) => (
                <TableRow
                  key={job.id}
                  className={cn(
                    idx !== jobs.length - 1 && "border-b-neutral-800/50",
                  )}
                >
                  <TableCell>{job.target?.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <JobTableStatusIcon status={job.job.status} />
                      {capitalCase(job.job.status)}
                    </div>
                  </TableCell>
                  <TableCell>{job.type}</TableCell>
                  <TableCell>
                    <TargetDropdownMenu
                      release={release}
                      deploymentName={deploymentName}
                      target={job.target}
                      environmentId={job.environmentId}
                      jobStatus={job.job.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))
          .value()}
      </TableBody>
    </Table>
  );
};
