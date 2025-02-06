"use client";

import type { JobAgent } from "@ctrlplane/db/schema";
import { IconLoader2 } from "@tabler/icons-react";

import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { JobAgentGitHubConfig } from "./JobAgentGitHubConfig";
import { JobAgentKubernetesConfig } from "./JobAgentKubernetesConfig";
import { JobAgentScriptConfig } from "./JobAgentScriptConfig";

type JobAgentConfigProps = {
  workspace: { id: string };
  jobAgent?: JobAgent | null;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
};

export const JobAgentConfig: React.FC<JobAgentConfigProps> = ({
  workspace,
  jobAgent,
  value,
  onChange,
}) => {
  const repos = api.github.entities.repos.list.useQuery(
    {
      owner: jobAgent?.config.owner,
      installationId: jobAgent?.config.installationId,
      workspaceId: workspace.id,
    },
    { enabled: jobAgent != null && jobAgent.type === "github-app" },
  );

  if (jobAgent == null)
    return <Input placeholder="Select a job agent" disabled />;
  if (jobAgent.type === "kubernetes-job")
    return <JobAgentKubernetesConfig value={value} onChange={onChange} />;
  if (jobAgent.type === "github-app" && repos.isLoading)
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 className="h-4 w-4 animate-spin" /> Loading repositories...
      </div>
    );
  if (jobAgent.type === "github-app" && repos.isSuccess)
    return (
      <JobAgentGitHubConfig
        value={value}
        onChange={onChange}
        repos={repos.data}
      />
    );

  if (jobAgent.type.startsWith("exec-"))
    return (
      <JobAgentScriptConfig
        type={jobAgent.type.startsWith("exec-windows") ? "powershell" : "shell"}
        value={value}
        onChange={onChange}
      />
    );

  return <Input placeholder="Unsupported job agent" disabled />;
};
