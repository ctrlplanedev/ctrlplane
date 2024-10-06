"use client";

import type { JobAgent } from "@ctrlplane/db/schema";

import { Input } from "@ctrlplane/ui/input";

import { JobAgentGitHubConfig } from "./JobAgentGitHubConfig";
import { JobAgentKubernetesConfig } from "./JobAgentKubernetesConfig";

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
  if (jobAgent == null)
    return <Input placeholder="Select a job agent" disabled />;
  if (jobAgent.type === "kubernetes-job")
    return <JobAgentKubernetesConfig value={value} onChange={onChange} />;
  if (jobAgent.type === "github-app")
    return (
      <JobAgentGitHubConfig
        className="w-80"
        value={value}
        jobAgent={jobAgent}
        workspaceId={workspace.id}
        onChange={onChange}
      />
    );
  return <Input placeholder="Unsupport job agent" disabled />;
};
