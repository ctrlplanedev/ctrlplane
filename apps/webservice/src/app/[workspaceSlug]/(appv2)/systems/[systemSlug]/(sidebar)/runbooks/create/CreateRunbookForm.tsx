"use client";

import type { JobAgent, System, Workspace } from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { createRunbookVariable } from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
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
import { Separator } from "@ctrlplane/ui/separator";
import { Textarea } from "@ctrlplane/ui/textarea";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { api } from "~/trpc/react";
import { RunbookVariablesEditor } from "./RunbookVariableEditor";

const createRunbookSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  variables: z.array(createRunbookVariable),
  jobAgentId: z.string().uuid({ message: "Must be a valid job agent ID" }),
  jobAgentConfig: z.record(z.any()),
});

const defaultValues = {
  name: "",
  description: "",
  variables: [],
  jobAgentId: "",
  jobAgentConfig: {},
};

export const CreateRunbook: React.FC<{
  workspace: Workspace;
  system: System;
  jobAgents: JobAgent[];
}> = ({ workspace, jobAgents, system }) => {
  const create = api.runbook.create.useMutation();
  const form = useForm({
    schema: createRunbookSchema,
    disabled: create.isPending,
    defaultValues,
  });

  const router = useRouter();
  const onSubmit = form.handleSubmit(async (data) => {
    const rb = await create.mutateAsync({ ...data, systemId: system.id });
    router.push(`/${workspace.slug}/systems/${system.slug}/runbooks/${rb.id}`);
    router.refresh();
  });

  const jobAgentId = form.watch("jobAgentId");
  const jobAgent = jobAgents.find((j) => j.id === jobAgentId);
  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="container mx-auto max-w-2xl space-y-8"
      >
        <div>
          <h1 className="mb-1 text-2xl font-bold">Create a new Runbook</h1>
          <p className="text-sm text-muted-foreground">
            Runbooks designed to automate common tasks and workflows that are
            not necessarily tied to specific environments
          </p>
        </div>

        <Separator />

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
        <Separator />

        <div className="space-y-3">
          <div>Variables</div>

          <div className="text-sm text-muted-foreground">
            Variables in runbooks make automation flexible and reusable. They
            let you customize runbooks with user inputs and use
            environment-specific values without hardcoding. This allows runbooks
            to adapt to different scenarios without changing their core logic.
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

        <Separator />

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

        <Separator />

        <Button type="submit">Create</Button>
        <FormRootError />
      </form>
    </Form>
  );
};
