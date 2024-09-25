"use client";

import type { JobAgent } from "@ctrlplane/db/schema";
import { IconGitPullRequest } from "@tabler/icons-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
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
}) => (
  <div>
    {jobAgent == null && <Input placeholder="Select a job agent" disabled />}
    {jobAgent != null && (
      <Card>
        {jobAgent.type === "kubernetes-job" && (
          <JobAgentKubernetesConfig value={value} onChange={onChange} />
        )}

        {jobAgent.type === "github-app" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1">
                <IconGitPullRequest /> Configure a github action
              </CardTitle>
              <CardDescription>
                Select a github action to run for this deployment.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <JobAgentGitHubConfig
                className="w-80"
                value={value}
                jobAgent={jobAgent}
                workspaceId={workspace.id}
                onChange={onChange}
              />
            </CardContent>
          </Card>
        )}
      </Card>
    )}
  </div>
);
