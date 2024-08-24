"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TbBolt, TbPlus } from "react-icons/tb";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";
import { ConfigureJobAgentGithub } from "./ConfigureJobAgentGithub";
import {
  ConfigureJobAgentKubernetesJob,
  VariablesList,
} from "./ConfigureJobAgentKubernetesJob";

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
    disabled: deployment.isLoading || jobAgents.isLoading,
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
            <TbBolt />
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
                      <div className="flex items-center gap-2">
                        <Select value={value} onValueChange={onChange}>
                          <SelectTrigger className="max-w-[350px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {jobAgents.data?.map((jobAgent) => (
                              <SelectItem key={jobAgent.id} value={jobAgent.id}>
                                {jobAgent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Link
                          href={`/${params.workspaceSlug}/job-agents/add`}
                          passHref
                        >
                          <Button
                            className="flex items-center"
                            variant="outline"
                            size="icon"
                          >
                            <TbPlus />
                          </Button>
                        </Link>
                      </div>
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
                      <Card>
                        {jobAgent == null && (
                          <div className="p-2 text-sm text-muted-foreground">
                            Select a job agent to configure.
                          </div>
                        )}
                        {jobAgent?.type === "kubernetes-job" && (
                          <ConfigureJobAgentKubernetesJob
                            value={value}
                            onChange={onChange}
                          />
                        )}

                        {jobAgent?.type === "github-app" && (
                          <ConfigureJobAgentGithub
                            value={value}
                            jobAgent={jobAgent}
                            onChange={onChange}
                          />
                        )}
                      </Card>
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
