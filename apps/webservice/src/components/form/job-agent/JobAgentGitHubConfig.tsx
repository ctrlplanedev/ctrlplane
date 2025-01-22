"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useState } from "react";
import { IconSelector } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

type Repo = RouterOutputs["github"]["entities"]["repos"]["list"][number];

export const JobAgentGitHubConfig: React.FC<{
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  repos: Repo[];
}> = ({ value, onChange, repos }) => {
  const [repoOpen, setRepoOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  const selectedRepo = repos.find((r) => r.name === value.repo);
  const workflows = selectedRepo?.workflows ?? [];

  const selectedWorkflow = workflows.find((w) => w.id === value.workflowId);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={repoOpen} onOpenChange={setRepoOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={repoOpen}
            className="w-80 items-center justify-start gap-2 px-2"
          >
            <IconSelector className="h-4 w-4" />
            <span className="overflow-hidden text-ellipsis">
              {value.repo ?? "Select repo..."}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command>
            <CommandInput placeholder="Search repo..." />
            <CommandGroup>
              <CommandList className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700">
                {repos.map((repo) => (
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
              </CommandList>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={workflowOpen} onOpenChange={setWorkflowOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={workflowOpen}
            className="w-80 items-center justify-start gap-2 px-2"
          >
            <IconSelector className="h-4 w-4" />
            <span className="overflow-hidden text-ellipsis">
              {selectedWorkflow?.name ?? "Select workflow..."}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command>
            <CommandInput placeholder="Search workflow..." />
            <CommandGroup>
              <CommandList>
                {workflows.map((wf) => (
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
              </CommandList>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        placeholder="Ref (uses default branch if not set)"
        className="w-80"
        value={value.ref ?? ""}
        onChange={(e) => onChange({ ...value, ref: e.target.value })}
      />
    </div>
  );
};
