"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";
import _ from "lodash";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import { Form, FormField, useForm } from "@ctrlplane/ui/form";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { api } from "~/trpc/react";

const JobAgentForm: React.FC<{
  jobAgent?: schema.JobAgent;
  jobAgents: schema.JobAgent[];
  jobAgentConfig: Record<string, any>;
  workspace: { id: string; slug: string };
  deploymentId: string;
}> = ({ jobAgents, workspace, jobAgent, jobAgentConfig, deploymentId }) => {
  const form = useForm({
    schema: z.object({
      jobAgentId: z.string().uuid(),
      jobAgentConfig: z.record(z.any()),
    }),
    defaultValues: { jobAgentId: jobAgent?.id ?? "", jobAgentConfig },
  });

  const update = api.deployment.update.useMutation();
  const router = useRouter();
  const onFormSubmit = form.handleSubmit((data) =>
    update.mutateAsync({ id: deploymentId, data }).then(() => router.refresh()),
  );

  const { jobAgentId, jobAgentConfig: formConfig } = form.watch();
  const selectedJobAgent = jobAgents.find((j) => j.id === jobAgentId);

  return (
    <Form {...form}>
      <form onSubmit={onFormSubmit} className="space-y-3">
        <FormField
          control={form.control}
          name="jobAgentId"
          render={({ field: { value, onChange } }) => (
            <JobAgentSelector
              className="max-w-[350px]"
              jobAgents={jobAgents}
              workspace={workspace}
              value={value}
              onChange={onChange}
            />
          )}
        />
        <Card className="rounded-md border-neutral-900 p-4">
          <FormField
            control={form.control}
            name="jobAgentConfig"
            render={({ field: { value, onChange } }) =>
              selectedJobAgent == null ? (
                <span className="px-2 text-sm text-muted-foreground">
                  Select a job agent
                </span>
              ) : (
                <JobAgentConfig
                  jobAgent={selectedJobAgent}
                  workspace={workspace}
                  value={value}
                  onChange={onChange}
                />
              )
            }
          />
        </Card>

        <Button
          type="submit"
          disabled={update.isPending || _.isEqual(formConfig, jobAgentConfig)}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};

export const JobAgentSection: React.FC<{
  jobAgent?: schema.JobAgent;
  jobAgents: schema.JobAgent[];
  jobAgentConfig: Record<string, any>;
  workspace: { id: string; slug: string };
  deploymentId: string;
}> = (props) => {
  return (
    <div className="container m-8 mx-auto max-w-3xl space-y-2">
      <div id="job-agent">
        <h2 className="">Job Agent</h2>
      </div>

      {props.jobAgent == null && (
        <Alert className="space-y-2 border-red-400 text-red-300">
          <AlertTitle className="font-semibold">
            Job agent not configured
          </AlertTitle>
          <AlertDescription>
            Job agents are used to dispatch jobs to the correct service. Without
            an agent new releases will not take any action.
          </AlertDescription>
        </Alert>
      )}
      <JobAgentForm {...props} />
    </div>
  );
};
