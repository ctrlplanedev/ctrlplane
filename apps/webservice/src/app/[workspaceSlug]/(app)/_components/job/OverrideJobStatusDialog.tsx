"use client";

import type * as schema from "@ctrlplane/db/schema";
import React, { useState } from "react";
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
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { toast } from "@ctrlplane/ui/toast";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

const overrideJobStatusFormSchema = z.object({
  status: z.nativeEnum(JobStatus),
});

type Job = { id: string; status: schema.Job["status"] };
const ALL_JOBS_STATUS = "all";

const useFilteredJobs = (jobs: Job[]) => {
  const [selectedStatus, setSelectedStatus] = useState<
    JobStatus | typeof ALL_JOBS_STATUS
  >(ALL_JOBS_STATUS);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>(jobs);

  const onStatusSelect = (status: JobStatus | typeof ALL_JOBS_STATUS) => {
    setSelectedStatus(status);
    if (status === ALL_JOBS_STATUS) {
      setFilteredJobs(jobs);
      return;
    }

    const newFilteredJobs = jobs.filter((job) => job.status === status);
    setFilteredJobs(newFilteredJobs);
  };

  const filteredJobIds = filteredJobs.map((job) => job.id);

  return { filteredJobIds, selectedStatus, onStatusSelect };
};

const JobFilterStatusSelect: React.FC<{
  value: JobStatus | typeof ALL_JOBS_STATUS;
  onChange: (value: JobStatus | typeof ALL_JOBS_STATUS) => void;
}> = ({ value, onChange }) => (
  <div className="space-y-2">
    <Label>Select jobs to override by status</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_JOBS_STATUS}>All statuses</SelectItem>
        {Object.values(JobStatus).map((status) => (
          <SelectItem key={status} value={status}>
            {capitalCase(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export const OverrideJobStatusDialog: React.FC<{
  jobs: Job[];
  children: React.ReactNode;
  enableStatusFilter?: boolean;
  onClose?: () => void;
}> = ({ jobs, onClose, enableStatusFilter = true, children }) => {
  const [open, setOpen] = useState(false);
  const updateJobs = api.job.updateMany.useMutation();
  const utils = api.useUtils();

  const { filteredJobIds, selectedStatus, onStatusSelect } =
    useFilteredJobs(jobs);

  const form = useForm({
    schema: overrideJobStatusFormSchema,
    defaultValues: { status: JobStatus.Cancelled },
  });

  const onSubmit = form.handleSubmit((data) =>
    updateJobs
      .mutateAsync({ ids: filteredJobIds, data })
      .then(() => toast.success("Job updates queued successfully"))
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

            {enableStatusFilter && (
              <JobFilterStatusSelect
                value={selectedStatus}
                onChange={onStatusSelect}
              />
            )}

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
