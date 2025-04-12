"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";
import _ from "lodash";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";
import { Form, FormField, useForm } from "@ctrlplane/ui/form";
import { JobAgentType } from "@ctrlplane/validators/jobs";

import { JobAgentKubernetesConfig } from "~/components/form/job-agent/JobAgentKubernetesConfig";
import { JobAgentScriptConfig } from "~/components/form/job-agent/JobAgentScriptConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { JobAgentJenkinsPipelineConfig } from "~/components/form/job-agent/JobAgentJenkinsPipelineConfig";
import { api } from "~/trpc/react";
import { DeploymentJobAgentGithubConfig } from "./DeploymentJobAgentGithubConfig";

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
    update
      .mutateAsync({ id: deploymentId, data })
      .then((data) =>
        form.reset({ ...data, jobAgentId: data.jobAgentId ?? undefined }),
      )
      .then(() => router.refresh()),
  );

  const { jobAgentId } = form.watch();
  const selectedJobAgent = jobAgents.find((j) => j.id === jobAgentId);

  return (
    <Form {...form}>
      <form onSubmit={onFormSubmit} className="space-y-6">
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

        <FormField
          control={form.control}
          name="jobAgentConfig"
          render={({ field }) => (
            <>
              {selectedJobAgent == null && (
                <span className="px-2 text-sm text-muted-foreground">
                  Select a job agent
                </span>
              )}
              {selectedJobAgent?.type === JobAgentType.KubernetesJob && (
                <JobAgentKubernetesConfig {...field} />
              )}
              {selectedJobAgent?.type === JobAgentType.GithubApp && (
                <DeploymentJobAgentGithubConfig
                  jobAgentId={jobAgentId}
                  currentConfig={jobAgentConfig}
                  {...field}
                  disabled={update.isPending}
                />
              )}
              {selectedJobAgent?.type.startsWith("exec") && (
                <JobAgentScriptConfig
                  type={
                    selectedJobAgent.type.startsWith(JobAgentType.ExecWindows)
                      ? "powershell"
                      : "shell"
                  }
                  {...field}
                  disabled={update.isPending}
                />
              )}
              {selectedJobAgent?.type === JobAgentType.Jenkins && (
                <JobAgentJenkinsPipelineConfig {...field} disabled={update.isPending} />
              )}
            </>
          )}
        />

        {selectedJobAgent?.type === JobAgentType.Jenkins && (
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
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
    <div className="container m-8 mx-auto flex max-w-3xl justify-center">
      <div className="space-y-4">
        <div id="job-agent">
          <h2 className="">Job Agent</h2>
        </div>

        {props.jobAgent == null && (
          <Alert className="space-y-2 border-red-400 text-red-300">
            <AlertTitle className="font-semibold">
              Job agent not configured
            </AlertTitle>
            <AlertDescription>
              Job agents are used to dispatch jobs to the correct service.
              Without an agent new deployment versions will not take any action.
            </AlertDescription>
          </Alert>
        )}
        <JobAgentForm {...props} />
      </div>
    </div>
  );
};
