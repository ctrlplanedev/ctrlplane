import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAdjustmentsExclamation,
  IconAlertTriangle,
  IconDots,
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
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

const overrideJobStatusFormSchema = z.object({
  status: z.nativeEnum(JobStatus),
});

const OverrideJobStatusDialog: React.FC<{
  job: { id: string; status: JobStatus };
  onClose: () => void;
  children: React.ReactNode;
}> = ({ job, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const updateJob = api.job.update.useMutation();
  const utils = api.useUtils();

  const form = useForm({
    schema: overrideJobStatusFormSchema,
    defaultValues: {
      status: JobStatus.Completed,
    },
  });

  const onSubmit = form.handleSubmit((data) =>
    updateJob
      .mutateAsync({
        id: job.id,
        data,
      })
      .then(() => utils.job.config.byReleaseId.invalidate())
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
      <DialogContent>
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
                            {Object.values(JobStatus)
                              .filter((status) => status !== job.status)
                              .map((status) => (
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

            {updateJob.error != null && (
              <div className="text-sm text-red-500">
                {updateJob.error.message}
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

export const TargetDropdownMenu: React.FC<{
  release: { id: string; version: string };
  environmentId: string;
  target: { id: string; name: string; lockedAt: Date | null } | null;
  deploymentName: string;
  job: { id: string; status: JobStatus };
}> = ({ release, deploymentName, target, environmentId, job }) => {
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
          <OverrideJobStatusDialog job={job} onClose={() => setOpen(false)}>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="space-x-2"
            >
              <IconAdjustmentsExclamation size={16} />
              <p>Override Job Status</p>
            </DropdownMenuItem>
          </OverrideJobStatusDialog>

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
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};
