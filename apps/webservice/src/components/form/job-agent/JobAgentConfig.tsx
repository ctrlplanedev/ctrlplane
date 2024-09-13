"use client";

import type { JobAgent } from "@ctrlplane/db/schema";

import { Card } from "@ctrlplane/ui/card";
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
  return (
    <div>
      {jobAgent == null && <Input placeholder="Select a job agent" disabled />}
      {jobAgent != null && (
        <Card>
          {jobAgent.type === "kubernetes-job" && (
            <JobAgentKubernetesConfig value={value} onChange={onChange} />
          )}

          {jobAgent.type === "github-app" && (
            <JobAgentGitHubConfig
              value={value}
              jobAgent={jobAgent}
              workspaceId={workspace.id}
              onChange={onChange}
            />
          )}
        </Card>
      )}
    </div>
  );
};
