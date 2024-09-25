"use client";

import { useRouter } from "next/navigation";
import { IconBolt } from "@tabler/icons-react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { VariablesList } from "~/components/form/job-agent/JobAgentVariableList";
import { api } from "~/trpc/react";

export default function ConfigureJobAgentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = api.deployment.bySlug.useQuery(params);
  const workspace = api.workspace.bySlug.useQuery(params.workspaceSlug);
  const jobAgents = api.job.agent.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );

  const form = useForm({
    schema: z.object({
      jobAgentId: z.string().uuid(),
      jobAgentConfig: z.record(z.any()),
    }),
    defaultValues: {
      jobAgentId: "",
      jobAgentConfig: {},
    },
  });

  const { jobAgentId } = form.watch();
  const jobAgent = jobAgents.data?.find((d) => d.id === jobAgentId);

  const router = useRouter();
  const utils = api.useUtils();
  const update = api.deployment.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    const deploymentId = deployment.data?.id;
    if (deploymentId == null) return;
    await update.mutateAsync({
      id: deploymentId,
      data: {
        jobAgentId: data.jobAgentId,
        jobAgentConfig: data.jobAgentConfig,
      },
    });

    utils.deployment.invalidate();
    router.push(
      `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}`,
    );
  });

  return (
    <ResizablePanelGroup direction={"horizontal"}>
      <ResizablePanel>
        <div className="container my-8 max-w-3xl space-y-4">
          <h1 className="mb-10 flex flex-grow items-center gap-3 text-2xl font-semibold">
            <IconBolt />
            Configure Agent
          </h1>

          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-3">
              <FormField
                control={form.control}
                name="jobAgentId"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Job Agent</FormLabel>
                    <FormControl>
                      {workspace.data && jobAgents.data && (
                        <JobAgentSelector
                          className="max-w-[350px]"
                          jobAgents={jobAgents.data}
                          workspace={workspace.data}
                          value={value}
                          onChange={onChange}
                        />
                      )}
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
                      {workspace.data && (
                        <JobAgentConfig
                          workspace={workspace.data}
                          jobAgent={jobAgent}
                          value={value}
                          onChange={onChange}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit">Save</Button>
              </div>
            </form>
          </Form>
        </div>
      </ResizablePanel>

      {jobAgent?.type === "kubernetes-job" && (
        <>
          <ResizableHandle />
          <ResizablePanel className="max-w-[500px]">
            <VariablesList />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
