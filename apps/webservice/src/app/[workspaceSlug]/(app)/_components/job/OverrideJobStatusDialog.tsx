"use client";

import { useState } from "react";
import { capitalCase } from "change-case";
import { z } from "zod";

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

export const OverrideJobStatusDialog: React.FC<{
  jobIds: string[];
  children: React.ReactNode;
  onClose?: () => void;
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
      .then(() => utils.deployment.version.list.invalidate())
      .then(() => setOpen(false))
      .then(() => onClose?.()),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose?.();
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
