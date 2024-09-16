"use client";

import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import _ from "lodash";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Form, FormField, useForm } from "@ctrlplane/ui/form";

import { JobAgentGitHubConfig } from "~/components/form/job-agent/JobAgentGitHubConfig";
import { JobAgentKubernetesConfig } from "~/components/form/job-agent/JobAgentKubernetesConfig";
import { JobAgentSelectorInput } from "~/components/form/job-agent/JobAgentSelector";
import { api } from "~/trpc/react";

type EditAgentConfigDialogProps = {
  jobAgents: schema.JobAgent[];
  jobAgent: schema.JobAgent;
  value: Record<string, any>;
  workspace: { id: string; slug: string };
  deploymentId: string;
  children: React.ReactNode;
};

export const EditAgentConfigDialog: React.FC<EditAgentConfigDialogProps> = ({
  jobAgents,
  jobAgent,
  value,
  workspace,
  deploymentId,
  children,
}) => {
  const form = useForm({
    schema: z.object({
      jobAgentId: z.string().uuid(),
      config: z.record(z.any()),
    }),
    defaultValues: {
      jobAgentId: jobAgent.id,
      config: value,
    },
  });
  const [open, setOpen] = useState(false);

  const updateDeployment = api.deployment.update.useMutation();
  const router = useRouter();

  const onSubmit = form.handleSubmit((data) =>
    updateDeployment
      .mutateAsync({
        id: deploymentId,
        data: {
          jobAgentConfig: data.config,
        },
      })
      .then(() => {
        router.refresh();
        setOpen(false);
      }),
  );

  const { jobAgentId } = form.watch();
  const selectedJobAgent = jobAgents.find((j) => j.id === jobAgentId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit agent</DialogTitle>
          <DialogDescription>
            Edit the agent configuration for this deployment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField
              control={form.control}
              name="jobAgentId"
              render={({ field: { value, onChange } }) => (
                <JobAgentSelectorInput
                  jobAgents={jobAgents}
                  value={value}
                  onChange={onChange}
                />
              )}
            />
            <FormField
              control={form.control}
              name="config"
              render={({ field: { value, onChange } }) => (
                <div>
                  {selectedJobAgent?.type === "github-app" && (
                    <div className="flex flex-col gap-3">
                      <JobAgentGitHubConfig
                        className="w-[462px]"
                        jobAgent={jobAgent}
                        value={value}
                        onChange={(v) => onChange(_.merge(value, v))}
                        workspaceId={workspace.id}
                      />
                    </div>
                  )}

                  {selectedJobAgent?.type === "kubernetes-job" && (
                    <JobAgentKubernetesConfig
                      value={value}
                      onChange={onChange}
                    />
                  )}
                </div>
              )}
            />
            <DialogFooter className="flex items-center justify-between">
              <Link
                href={`/${workspace.slug}/job-agents/integrations`}
                passHref
              >
                <Button className="flex w-fit items-center" variant="outline">
                  Add agent
                </Button>
              </Link>
              <div className="flex-grow" />
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
