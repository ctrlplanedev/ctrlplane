"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAdjustmentsExclamation,
  IconAlertTriangle,
  IconReload,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { z } from "zod";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { activeStatus, JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

const overrideJobStatusFormSchema = z.object({
  status: z.nativeEnum(JobStatus),
});

export const OverrideJobStatusDialog: React.FC<{
  jobIds: string[];
  onClose: () => void;
  children: React.ReactNode;
}> = ({ jobIds, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const updateJobs = api.job.updateMany.useMutation();
  const utils = api.useUtils();

  const form = useForm({
    schema: overrideJobStatusFormSchema,
    defaultValues: { status: JobStatus.Cancelled },
  });

  const onSubmit = form.handleSubmit((data) =>
    updateJobs
      .mutateAsync({ ids: jobIds, data })
      .then(() => utils.job.config.byDeploymentVersionId.invalidate())
      .then(() => jobIds.map((id) => utils.job.config.byId.invalidate(id)))
      .then(() => utils.deployment.version.list.invalidate())
      .then(() => setOpen(false))
      .then(() => onClose()),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                Are you sure you want to override the job status?
              </DialogTitle>
            </DialogHeader>

            <FormField
              control={form.control}
              name="status"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select value={value} onValueChange={onChange}>
                      <SelectGroup>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {Object.values(JobStatus).map((status) => (
                              <SelectItem key={status} value={status}>
                                {capitalCase(status)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </SelectGroup>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            {updateJobs.error != null && (
              <div className="text-sm text-red-500">
                {updateJobs.error.message}
              </div>
            )}

            <DialogFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <div className="flex-grow" />
              <Button
                type="submit"
                className={buttonVariants({ variant: "destructive" })}
                disabled={updateJobs.isPending}
              >
                Override
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const ForceDeployToResourceDialog: React.FC<{
  deployment: { id: string; name: string };
  resource: { id: string; name: string };
  environmentId: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ deployment, resource, environmentId, onClose, children }) => {
  const redeploy = api.redeploy.useMutation();
  const utils = api.useUtils();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to force deploy?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span>
              This will force the last comptiable version to{" "}
              <Badge variant="secondary">{resource.name}</Badge> for
              <strong>{deployment.name}</strong>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex justify-end gap-2">
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={redeploy.isPending}
            onClick={() =>
              redeploy
                .mutateAsync({
                  resourceId: resource.id,
                  deploymentId: deployment.id,
                  environmentId: environmentId,
                  force: true,
                })
                .then(() => utils.deployment.version.list.invalidate())
                .then(() => router.refresh())
                .then(() => setOpen(false))
                .then(() => onClose())
            }
          >
            Force Deploy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const RedeployVersionDialog: React.FC<{
  deployment: { id: string; name: string };
  environmentId: string;
  resource: { id: string; name: string };
  children: React.ReactNode;
}> = ({ deployment, environmentId, resource, children }) => {
  const router = useRouter();
  const utils = api.useUtils();
  const redeploy = api.redeploy.useMutation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Redeploy latest version to {resource.name}?</DialogTitle>
          <DialogDescription>
            This will redeploy the latest version to {resource.name}.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            disabled={redeploy.isPending}
            onClick={() =>
              redeploy
                .mutateAsync({
                  deploymentId: deployment.id,
                  environmentId,
                  resourceId: resource.id,
                })
                .then(() => utils.deployment.version.list.invalidate())
                .then(() => router.refresh())
                .then(() => setIsOpen(false))
            }
          >
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const JobDropdownMenu: React.FC<{
  environmentId: string;
  resource: { id: string; name: string; lockedAt: Date | null } | null;
  deployment: SCHEMA.Deployment;
  job: { id: string; status: JobStatus };
  isPassingDeploymentVersionChannel: boolean;
  children: React.ReactNode;
}> = ({
  deployment,
  resource,
  environmentId,
  job,
  isPassingDeploymentVersionChannel,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const isActive = activeStatus.includes(job.status);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      {resource != null && (
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {isActive && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="space-x-2 text-muted-foreground hover:cursor-not-allowed focus:bg-transparent focus:text-muted-foreground"
                  >
                    <IconReload className="h-4 w-4" />
                    <p>Redeploy</p>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent>
                  Cannot redeploy while job is in progress
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!isActive && !isPassingDeploymentVersionChannel && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="space-x-2 text-muted-foreground hover:cursor-not-allowed focus:bg-transparent focus:text-muted-foreground"
                  >
                    <IconReload className="h-4 w-4" />
                    <p>Redeploy</p>
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent>
                  Version channel does not match selector
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!isActive && isPassingDeploymentVersionChannel && (
            <RedeployVersionDialog
              deployment={deployment}
              environmentId={environmentId}
              resource={resource}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="space-x-2"
              >
                <IconReload className="h-4 w-4" />
                <p>Redeploy</p>
              </DropdownMenuItem>
            </RedeployVersionDialog>
          )}

          <OverrideJobStatusDialog
            jobIds={[job.id]}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="space-x-2"
            >
              <IconAdjustmentsExclamation size={16} />
              <p>Override Job Status</p>
            </DropdownMenuItem>
          </OverrideJobStatusDialog>

          <ForceDeployToResourceDialog
            deployment={deployment}
            resource={resource}
            environmentId={environmentId}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="space-x-2"
            >
              <IconAlertTriangle size={16} />
              <p>Force Deploy</p>
            </DropdownMenuItem>
          </ForceDeployToResourceDialog>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};
