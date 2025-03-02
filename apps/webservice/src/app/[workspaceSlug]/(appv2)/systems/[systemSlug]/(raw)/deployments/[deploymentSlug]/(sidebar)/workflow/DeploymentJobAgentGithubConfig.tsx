import type React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  IconBrandGithub,
  IconExternalLink,
  IconLoader2,
  IconSelector,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

export const DeploymentJobAgentGithubConfig: React.FC<{
  jobAgentId: string;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  disabled?: boolean;
}> = ({ jobAgentId, value, onChange, disabled = false }) => {
  const [repoOpen, setRepoOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  const { data: githubAgent, isLoading: isGithubAgentLoading } =
    api.job.agent.github.byId.useQuery(jobAgentId);
  const { data: repos, isLoading: isReposLoading } =
    api.github.entities.repos.list.useQuery(
      {
        installationId: githubAgent?.ghEntity.installationId ?? 0,
        owner: githubAgent?.ghEntity.slug ?? "",
        workspaceId: githubAgent?.workspaceId ?? "",
      },
      { enabled: githubAgent != null },
    );

  const selectedRepo = repos?.find((r) => r.name === value.repo);
  const workflows = selectedRepo?.workflows ?? [];
  const selectedWorkflow = workflows.find((w) => w.id === value.workflowId);

  const isChanged =
    selectedRepo?.name !== value.repo ||
    selectedWorkflow?.id !== value.workflowId;

  if (isGithubAgentLoading || isReposLoading)
    return (
      <div className="flex w-96 items-center justify-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 className="h-4 w-4 animate-spin" /> Loading{" "}
        {isGithubAgentLoading ? "GitHub agent" : "repositories"}...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Avatar className="size-14">
          <AvatarImage src={githubAgent?.ghEntity.avatarUrl ?? ""} />
          <AvatarFallback>
            <IconBrandGithub />
          </AvatarFallback>
        </Avatar>

        <span className="text-2xl font-semibold">
          {githubAgent?.ghEntity.slug}
        </span>
      </div>

      <div className="flex w-96 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label className="font-medium">Repository</Label>
          <Popover open={repoOpen} onOpenChange={setRepoOpen} modal>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={repoOpen}
                className="items-center justify-start gap-2 px-2"
              >
                <IconSelector className="h-4 w-4" />
                <span className="overflow-hidden text-ellipsis">
                  {selectedRepo?.name ?? "Select repo..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder="Search repo..." />
                <CommandGroup>
                  <CommandList className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700">
                    {(repos ?? []).map((repo) => (
                      <CommandItem
                        key={repo.id}
                        value={repo.name}
                        onSelect={(currentValue) => {
                          onChange({ ...value, repo: currentValue });
                          setRepoOpen(false);
                        }}
                      >
                        {repo.name}
                      </CommandItem>
                    ))}

                    {(repos ?? []).length === 0 && (
                      <CommandEmpty className="flex justify-center py-2 text-sm text-muted-foreground">
                        No repos found
                      </CommandEmpty>
                    )}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="font-medium">Workflow</Label>
          <Popover open={workflowOpen} onOpenChange={setWorkflowOpen} modal>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={workflowOpen}
                className="items-center justify-start gap-2 px-2"
              >
                <IconSelector className="h-4 w-4" />
                <span className="overflow-hidden text-ellipsis">
                  {selectedWorkflow?.name ?? "Select workflow..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder="Search workflow..." />
                <CommandGroup>
                  <CommandList>
                    {workflows.length > 0 &&
                      workflows.map((wf) => (
                        <CommandItem
                          key={wf.id}
                          value={wf.id.toString()}
                          onSelect={(currentValue) => {
                            onChange({
                              ...value,
                              workflowId: Number.parseInt(currentValue),
                            });
                            setWorkflowOpen(false);
                          }}
                        >
                          {wf.name}
                        </CommandItem>
                      ))}

                    {workflows.length === 0 && (
                      <CommandEmpty className="flex justify-center py-2 text-sm text-muted-foreground">
                        No workflows found
                      </CommandEmpty>
                    )}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="font-medium">Git reference</Label>
          <Input
            placeholder="(uses repositories default if not set)"
            value={value.ref ?? ""}
            onChange={(e) => {
              const ref = e.target.value === "" ? null : e.target.value;
              onChange({ ...value, ref });
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={disabled || !isChanged}>
          Save
        </Button>

        {selectedWorkflow != null && (
          <Link
            href={selectedWorkflow.html_url}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex items-center gap-2",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconExternalLink className="h-4 w-4" />
            workflow
          </Link>
        )}
      </div>
    </div>
  );
};
