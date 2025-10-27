import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import {
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
import { useSelectedJobAgent } from "../_hooks/job-agents";

const formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: z.record(z.any()),
});

type Form = UseFormReturn<z.infer<typeof formSchema>>;

type GithubAgentConfigProps = {
  form: Form;
};

const useGithubRepos = (form: Form) => {
  const { workspace } = useWorkspace();
  const selectedJobAgent = useSelectedJobAgent(form);
  const githubReposQuery = trpc.github.reposForAgent.useQuery(
    { workspaceId: workspace.id, jobAgentId: selectedJobAgent?.id ?? "" },
    { enabled: selectedJobAgent != null },
  );
  return (githubReposQuery.data ?? []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
};

function RepoSelector({ form }: { form: Form }) {
  const githubRepos = useGithubRepos(form);

  return (
    <FormField
      control={form.control}
      name="jobAgentConfig.repo"
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormLabel>Repository</FormLabel>
          <FormControl>
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {githubRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.name}>
                    {repo.name}
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

const useRepoWorkflows = (form: Form) => {
  const githubRepos = useGithubRepos(form);
  const selectedRepoName = form.watch("jobAgentConfig.repo");
  const selectedRepo = githubRepos.find(
    (repo) => repo.name === String(selectedRepoName),
  );
  return (selectedRepo?.workflows ?? []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
};

function WorkflowSelector({ form }: { form: Form }) {
  const repoWorkflows = useRepoWorkflows(form);
  return (
    <FormField
      control={form.control}
      name="jobAgentConfig.workflowId"
      render={({ field: { value, onChange } }) => (
        <FormItem>
          <FormLabel>Workflow</FormLabel>
          <FormControl>
            <Select value={String(value)} onValueChange={onChange}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select a workflow" />
              </SelectTrigger>
              <SelectContent>
                {repoWorkflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id.toString()}>
                    {workflow.name}
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

export function GithubAgentConfig({ form }: GithubAgentConfigProps) {
  return (
    <div className="mt-2 flex flex-col gap-6">
      <RepoSelector form={form} />
      <WorkflowSelector form={form} />
    </div>
  );
}
