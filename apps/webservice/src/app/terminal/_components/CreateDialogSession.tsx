"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { IconCheck, IconSelector } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";
import { useTerminalSessions } from "./TerminalSessionsProvider";

export const CreateSessionDialog: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isModalOpen, setModelOpen] = useState(false);
  const { createSession, setIsDrawerOpen } = useTerminalSessions();

  const workspaces = api.workspace.list.useQuery();
  const [resourceId, setResourceId] = React.useState("");

  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug ?? "", {
    enabled: workspaceSlug != null,
  });

  const [workspaceId, setWorkspaceId] = useState("");

  const resources = api.resource.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace.data?.id ?? workspaceId,
      limit: 500,
      filter: {
        type: "kind",
        operator: "equals",
        value: "AccessNode",
      },
    },
    { enabled: workspace.data != null || workspaceId != "" },
  );

  const [isResourcePopoverOpen, setIsResourcePopoverOpen] = useState(false);
  const [isWorkspacePopoverOpen, setIsWorkspacePopoverOpen] = useState(false);
  return (
    <Dialog open={isModalOpen} onOpenChange={setModelOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Remote Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {workspaceSlug == null && (
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="picture">Workspace</Label>

              <Popover
                open={isWorkspacePopoverOpen}
                onOpenChange={setIsWorkspacePopoverOpen}
                modal={true}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isWorkspacePopoverOpen}
                    className="w-full items-center justify-start gap-2 bg-transparent px-2 hover:bg-neutral-800/50"
                  >
                    <IconSelector className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {workspaceId === ""
                        ? "Select workspace..."
                        : workspaces.data?.find((t) => t.id === workspaceId)
                            ?.name}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search resource..."
                      className="h-9"
                    />

                    <CommandList>
                      <CommandEmpty>Workspaces not found.</CommandEmpty>

                      <CommandGroup>
                        {workspaces.data?.map((workspace) => (
                          <CommandItem
                            key={workspace.id}
                            value={workspace.id}
                            onSelect={(currentValue) => {
                              setWorkspaceId(
                                currentValue === workspaceId
                                  ? ""
                                  : currentValue,
                              );
                              setIsWorkspacePopoverOpen(false);
                            }}
                          >
                            {workspace.name}
                            <IconCheck
                              className={cn(
                                "ml-auto",
                                workspaceId === workspace.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="picture">Resources</Label>

            <Popover
              open={isResourcePopoverOpen}
              onOpenChange={setIsResourcePopoverOpen}
              modal={true}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isResourcePopoverOpen}
                  className="w-full items-center justify-start gap-2 bg-transparent px-2 hover:bg-neutral-800/50"
                >
                  <IconSelector className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {resourceId === ""
                      ? "Select resources..."
                      : resources.data?.items.find((r) => r.id === resourceId)
                          ?.name}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search resources..."
                    className="h-9"
                  />

                  <CommandList>
                    <CommandEmpty>No resource found.</CommandEmpty>

                    <CommandGroup>
                      {resources.data?.items.map((resource) => (
                        <CommandItem
                          key={resource.id}
                          value={resource.id}
                          onSelect={(currentValue) => {
                            setResourceId(
                              currentValue === resourceId ? "" : currentValue,
                            );
                            setIsResourcePopoverOpen(false);
                          }}
                        >
                          {resource.name}
                          <IconCheck
                            className={cn(
                              "ml-auto",
                              resourceId === resource.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              createSession(resourceId);
              setModelOpen(false);
              setIsDrawerOpen(true);
            }}
            disabled={
              resourceId === "" || (workspaceId === "" && workspaceSlug == null)
            }
          >
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
