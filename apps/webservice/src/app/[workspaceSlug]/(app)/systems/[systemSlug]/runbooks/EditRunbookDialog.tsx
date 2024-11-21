"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { JobAgent, Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { createRunbookVariable } from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
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
  FormMessage,
  FormRootError,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { api } from "~/trpc/react";
import { RunbookVariablesEditor } from "./create/RunbookVariableEditor";

const updateRunbookSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  variables: z.array(createRunbookVariable),
  jobAgentId: z.string().uuid({ message: "Must be a valid job agent ID" }),
  jobAgentConfig: z.record(z.any()),
});

export const EditRunbookDialog: React.FC<{
  workspace: Workspace;
  jobAgents: JobAgent[];
  runbook: RouterOutputs["runbook"]["bySystemId"][number];
  children: React.ReactNode;
}> = ({ workspace, jobAgents, runbook, children }) => {
  const [open, setOpen] = useState(false);
  const update = api.runbook.update.useMutation();
  const form = useForm({
    schema: updateRunbookSchema,
    disabled: update.isPending,
    defaultValues: {
      ...runbook,
      description: runbook.description ?? "",
      jobAgentId: runbook.jobAgentId ?? "",
    },
  });

  const router = useRouter();
  const onSubmit = form.handleSubmit(async (data) =>
    update
      .mutateAsync({ id: runbook.id, data })
      .then(() => router.refresh())
      .then(() => setOpen(false)),
  );

  const jobAgentId = form.watch("jobAgentId");
  const jobAgent = jobAgents.find((j) => j.id === jobAgentId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 max-h-[95vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Runbook</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="space-y-3">
              <div>General</div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Deploy Hotfix, Rollback Release, Scale Service..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the purpose of this runbook..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div>Variables</div>

              <div className="text-sm text-muted-foreground">
                Variables in runbooks make automation flexible and reusable.
                They let you customize runbooks with user inputs and use
                environment-specific values without hardcoding. This allows
                runbooks to adapt to different scenarios without changing their
                core logic.
              </div>

              <FormField
                control={form.control}
                name="variables"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RunbookVariablesEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div>Agent</div>

              <FormField
                control={form.control}
                name="jobAgentId"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Job Agent</FormLabel>
                    <FormControl>
                      <JobAgentSelector
                        jobAgents={jobAgents}
                        workspace={workspace}
                        value={value}
                        onChange={onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobAgentConfig"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Config</FormLabel>
                    <FormControl>
                      <JobAgentConfig
                        jobAgent={jobAgent}
                        workspace={workspace}
                        value={value}
                        onChange={onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit">Save</Button>
            <FormRootError />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
