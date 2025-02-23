"use client";

import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { RunbookVariablesEditor } from "./create/RunbookVariableEditor";

export const updateRunbookSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  variables: z.array(SCHEMA.createRunbookVariable),
  jobAgentId: z.string().uuid({ message: "Must be a valid job agent ID" }),
  jobAgentConfig: z.record(z.any()),
});

export type EditRunbookFormSchema = z.infer<typeof updateRunbookSchema>;

export type EditRunbookFormProps = {
  form: UseFormReturn<EditRunbookFormSchema>;
  jobAgents: SCHEMA.JobAgent[];
  jobAgent?: SCHEMA.JobAgent;
  workspace: SCHEMA.Workspace;
  onSubmit: (data: EditRunbookFormSchema) => void;
};

export const EditRunbookForm: React.FC<EditRunbookFormProps> = ({
  form,
  jobAgents,
  jobAgent,
  workspace,
  onSubmit,
}) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
          Variables in runbooks make automation flexible and reusable. They let
          you customize runbooks with user inputs and use environment-specific
          values without hardcoding. This allows runbooks to adapt to different
          scenarios without changing their core logic.
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
);
