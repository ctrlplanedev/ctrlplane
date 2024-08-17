"use client";

import type { JobAgent } from "@ctrlplane/db/schema";
import { useState } from "react";
import { TbGitPullRequest, TbSelector } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

export const ConfigureJobAgentGithub: React.FC<{
  value: Record<string, any>;
  jobAgent: JobAgent;
  onChange: (v: Record<string, any>) => void;
}> = ({ value, jobAgent, onChange }) => {
  const repos = api.github.organizations.repos.list.useQuery({
    login: jobAgent.config.login,
    installationId: jobAgent.config.installationId,
  });

  console.log({ repos: repos.data });

  const [repoOpen, setRepoOpen] = useState(false);
  const [repo, setRepo] = useState<string | null>(value.repo ?? null);

  const workflows = api.github.organizations.repos.workflows.list.useQuery(
    {
      installationId: jobAgent.config.installationId,
      repo: repo ?? "",
      login: jobAgent.config.login,
    },
    { enabled: repo != null },
  );

  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflow, setWorkflow] = useState<string | null>(
    workflows.data?.data.workflows.find((w) => w.id === value.workflowId)
      ?.name ?? null,
  );

  const handleFormChange = (workflow: string) => {
    const workflowId = workflows.data?.data.workflows.find(
      (w) => w.name === workflow,
    )?.id;
    if (workflowId == null) return;

    onChange({
      installationId: jobAgent.config.installationId,
      login: jobAgent.config.login,
      repo,
      workflowId,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          <TbGitPullRequest /> Configure a github action
        </CardTitle>
        <CardDescription>
          Select a github action to run for this deployment.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Popover open={repoOpen} onOpenChange={setRepoOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={repoOpen}
              className="w-[250px] items-center justify-start gap-2 px-2"
            >
              <TbSelector />
              <span className="overflow-hidden text-ellipsis">
                {repo ?? "Select repo..."}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0">
            <Command>
              <CommandInput placeholder="Search repo..." />
              <CommandGroup>
                <CommandList>
                  {repos.data?.data.map((repo) => (
                    <CommandItem
                      key={repo.id}
                      value={repo.name}
                      onSelect={(currentValue) => {
                        setRepo(currentValue);
                        setRepoOpen(false);
                      }}
                    >
                      {repo.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover open={workflowOpen} onOpenChange={setWorkflowOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={workflowOpen}
              className="w-[250px] items-center justify-start gap-2 px-2"
            >
              <TbSelector />
              <span className="overflow-hidden text-ellipsis">
                {workflow ?? "Select workflow..."}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0">
            <Command>
              <CommandInput placeholder="Search workflow..." />
              <CommandGroup>
                <CommandList>
                  {(workflows.data == null ||
                    workflows.data.data.total_count === 0) && (
                    <CommandItem disabled>No workflows found</CommandItem>
                  )}
                  {workflows.data?.data.workflows.map((wf) => (
                    <CommandItem
                      key={wf.id}
                      value={wf.name}
                      onSelect={(currentValue) => {
                        setWorkflow(currentValue);
                        setWorkflowOpen(false);
                        handleFormChange(currentValue);
                      }}
                    >
                      {wf.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
};
