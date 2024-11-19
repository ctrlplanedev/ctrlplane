"use client";

import type { JobAgent } from "@ctrlplane/db/schema";

import { Input } from "@ctrlplane/ui/input";

import type { JobAgentGithubStyleCongig } from "./JobAgentGitHubConfig";
import { JobAgentGitHubConfig } from "./JobAgentGitHubConfig";
import { JobAgentKubernetesConfig } from "./JobAgentKubernetesConfig";

type JobAgentConfigProps = {
  workspace: { id: string };
  jobAgent?: JobAgent | null;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  githubFormStyleConfig?: JobAgentGithubStyleCongig;
};

export const JobAgentConfig: React.FC<JobAgentConfigProps> = ({
  workspace,
  jobAgent,
  value,
  onChange,
  githubFormStyleConfig,
}) => {
  if (jobAgent == null)
    return <Input placeholder="Select a job agent" disabled />;
  if (jobAgent.type === "kubernetes-job")
    return <JobAgentKubernetesConfig value={value} onChange={onChange} />;
  if (jobAgent.type === "github-app")
    return (
      <JobAgentGitHubConfig
        styleConfig={githubFormStyleConfig}
        value={value}
        jobAgent={jobAgent}
        workspaceId={workspace.id}
        onChange={onChange}
      />
    );
  return <Input placeholder="Unsupport job agent" disabled />;
};
