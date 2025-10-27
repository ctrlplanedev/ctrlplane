import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { Control, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "../_components/DeploymentProvider";
import { GithubAgentConfig } from "./_components/GithubAgentConfig";
import { useAllJobAgents, useSelectedJobAgent } from "./_hooks/job-agents";

const formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: z.record(z.any()),
});

type JobAgentSelectorProps = {
  control: Control<z.infer<typeof formSchema>>;
};

function JobAgentSelector({ control }: JobAgentSelectorProps) {
  const allJobAgents = useAllJobAgents();
  return (
    <FormField
      control={control}
      name="jobAgentId"
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormLabel>Job Agent</FormLabel>
          <FormControl>
            <Select onValueChange={onChange} value={value}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select a job agent" />
              </SelectTrigger>
              <SelectContent align="start">
                {allJobAgents.map(({ id, name, type }) => (
                  <SelectItem key={id} value={id}>
                    {name} ({type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function JobAgentConfigSection({
  form,
}: {
  form: UseFormReturn<z.infer<typeof formSchema>>;
}) {
  const selectedJobAgent = useSelectedJobAgent(form);
  return (
    <FormField
      {...form}
      name="jobAgentConfig"
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormLabel>Config</FormLabel>
          <FormControl>
            <>
              {selectedJobAgent == null && (
                <span className="px-2 text-sm text-muted-foreground">
                  Select a job agent
                </span>
              )}
              {selectedJobAgent?.type === "github-app" && (
                <GithubAgentConfig form={form} />
              )}
            </>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const useJobAgentForm = () => {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobAgentId: deployment.jobAgentId ?? "",
      jobAgentConfig: deployment.jobAgentConfig ?? {},
    },
  });

  const updateAgentMutation = trpc.deployment.updateJobAgent.useMutation();
  const onSubmit = form.handleSubmit((data) =>
    updateAgentMutation
      .mutateAsync({
        workspaceId: workspace.id,
        deploymentId: deployment.id,
        jobAgentId: data.jobAgentId,
        jobAgentConfig: data.jobAgentConfig,
      })
      .then((data) => form.reset(data))
      .then(() => toast.success("Job agent update queued successfully")),
  );

  return { form, onSubmit, isPending: updateAgentMutation.isPending };
};

function JobAgentForm() {
  const { form, onSubmit, isPending } = useJobAgentForm();
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <JobAgentSelector {...form} />
        <JobAgentConfigSection form={form} />
        <Button type="submit" disabled={isPending}>
          Save
        </Button>
      </form>
    </Form>
  );
}

export default function DeploymentJobAgentPage() {
  const { deployment } = useDeployment();

  return (
    <div className="m-8 max-w-3xl justify-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Job Agent</h2>
        <p className="text-sm text-muted-foreground">
          Job agents are used to dispatch jobs to the correct service. Without
          an agent new deployment versions will not take any action.
        </p>
      </div>

      {deployment.jobAgentId == null && (
        <Alert className="space-y-2 border-red-400 text-red-300">
          <AlertTitle className="font-semibold">
            Job agent not configured
          </AlertTitle>
          <AlertDescription>
            Job agents are used to dispatch jobs to the correct service. Without
            an agent new deployment versions will not take any action.
          </AlertDescription>
        </Alert>
      )}

      <JobAgentForm />
    </div>
  );
}
