"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import slugify from "slugify";

import * as SCHEMA from "@ctrlplane/db/schema";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { api } from "~/trpc/react";

export const CreateDeploymentDialog: React.FC<{
  children?: React.ReactNode;
  systemId?: string;
  onSuccess?: () => void;
}> = ({ children, onSuccess, ...props }) => {
  const [open, setOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspace, ...workspaceQ } =
    api.workspace.bySlug.useQuery(workspaceSlug);
  const { data: systems, ...systemsQ } = api.system.list.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: workspace != null },
  );
  const createDeployment = api.deployment.create.useMutation();
  const router = useRouter();
  const { data: jobAgentsResult, ...jobAgentsQ } =
    api.job.agent.byWorkspaceId.useQuery(workspace?.id ?? "", {
      enabled: workspace != null,
    });
  const jobAgents = jobAgentsResult ?? [];

  const form = useForm({
    schema: SCHEMA.createDeployment,
    defaultValues: {
      systemId: props.systemId ?? systems?.items[0]?.id,
      name: "",
      slug: "",
      description: "",
      retryCount: 0,
    },
    mode: "onSubmit",
  });

  const { handleSubmit, watch, setValue, setError } = form;

  const selectedJobAgentId = watch("jobAgentId");
  const selectedJobAgent = jobAgents.find(
    (agent) => agent.id === selectedJobAgentId,
  );

  watch((data, { name: fieldName }) => {
    if (fieldName === "name")
      setValue("slug", slugify(data.name ?? "", { lower: true }));
  });

  const onSubmit = handleSubmit(async (deployment) => {
    const systemSlug = systems?.items.find(
      (system) => system.id === deployment.systemId,
    )?.slug;
    await createDeployment
      .mutateAsync(deployment)
      .then(
        () =>
          systemSlug != null &&
          router.push(
            `/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}`,
          ),
      )
      .then(() => setOpen(false))
      .then(() => onSuccess?.())
      .catch(() =>
        setError("root", {
          message: "Deployment with this slug already exists",
        }),
      );
  });

  const loading =
    workspaceQ.isLoading || systemsQ.isLoading || jobAgentsQ.isLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New Deployment</DialogTitle>
              <DialogDescription>
                Deploy can be a application, services, or infrastructure. It
                executes pipelines to create instances of the system.
              </DialogDescription>
            </DialogHeader>

            {loading && (
              <div className="flex h-full w-full items-center justify-center">
                <IconLoader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {!loading && (
              <>
                <FormField
                  control={form.control}
                  name="systemId"
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      <FormLabel>System</FormLabel>
                      <FormControl>
                        <Select value={value} onValueChange={onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {systems?.items.map((system) => (
                                <SelectItem key={system.id} value={system.id}>
                                  {system.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Website, Identity Service..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {workspace != null && (
                  <FormField
                    control={form.control}
                    name="jobAgentId"
                    render={({ field: { value, onChange } }) => (
                      <FormItem>
                        <FormLabel>Job Agent</FormLabel>
                        <FormControl>
                          <JobAgentSelector
                            className="max-w-[350px]"
                            jobAgents={jobAgents}
                            workspace={workspace}
                            value={value ?? undefined}
                            onChange={onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {workspace != null && (
                  <FormField
                    control={form.control}
                    name="jobAgentConfig"
                    render={({ field: { value, onChange } }) => (
                      <FormItem>
                        <FormLabel>Config</FormLabel>
                        <FormControl>
                          <JobAgentConfig
                            workspace={workspace}
                            jobAgent={selectedJobAgent}
                            value={value ?? {}}
                            onChange={onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="retryCount"
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      <FormLabel>Retry Count</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={value}
                          onChange={(e) => onChange(e.target.valueAsNumber)}
                          className="w-16"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormRootError />
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
