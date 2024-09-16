"use client";

import type { JobAgent } from "@ctrlplane/db/schema";
import { useEffect, useState } from "react";
import { TbSelector } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

export const JobAgentGitHubConfig: React.FC<{
  value: Record<string, any>;
  jobAgent: JobAgent;
  workspaceId: string;
  onChange: (v: Record<string, any>) => void;
  className?: string;
}> = ({ value, jobAgent, workspaceId, onChange, className }) => {
  const repos = api.github.organizations.repos.list.useQuery({
    owner: jobAgent.config.owner,
    installationId: jobAgent.config.installationId,
    workspaceId,
  });

  const [repoOpen, setRepoOpen] = useState(false);
  const [repo, setRepo] = useState<string | null>(value.repo ?? null);

  const workflows = api.github.organizations.repos.workflows.list.useQuery(
    {
      installationId: jobAgent.config.installationId,
      repo: repo ?? "",
      owner: jobAgent.config.owner,
      workspaceId,
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
      owner: jobAgent.config.owner,
      repo,
      workflowId,
    });
  };

  useEffect(() => {
    if (workflows.data != null && value.workflowId != null) {
      setWorkflow(
        workflows.data.data.workflows.find((w) => w.id === value.workflowId)
          ?.name ?? null,
      );
    }
  }, [workflows.data, value.workflowId]);

  return (
    <>
      <Popover open={repoOpen} onOpenChange={setRepoOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={repoOpen}
            className={cn("items-center justify-start gap-2 px-2", className)}
          >
            <TbSelector />
            <span className="overflow-hidden text-ellipsis">
              {repo ?? "Select repo..."}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0", className)}>
          <Command>
            <CommandInput placeholder="Search repo..." />
            <CommandGroup>
              <CommandList>
                {repos.data?.map((repo) => (
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
            className={cn("items-center justify-start gap-2 px-2", className)}
          >
            <TbSelector />
            <span className="overflow-hidden text-ellipsis">
              {workflow ?? "Select workflow..."}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0", className)}>
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
    </>
  );
};
