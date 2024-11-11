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
  const { createSession } = useTerminalSessions();

  const [targetId, setTargetId] = React.useState("");

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const targets = api.target.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace.data?.id ?? "",
      limit: 500,
      filter: {
        type: "kind",
        operator: "equals",
        value: "TargetSession",
      },
    },
    { enabled: workspace.data != null },
  );

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setModelOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create New Terminal Session {workspace.data?.name}{" "}
            {workspace.data != null ? "true" : "false"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="picture">Targets</Label>

            <Popover
              open={isPopoverOpen}
              onOpenChange={setIsPopoverOpen}
              modal={true}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isPopoverOpen}
                  className="w-full items-center justify-start gap-2 bg-transparent px-2 hover:bg-neutral-800/50"
                >
                  <IconSelector className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {targetId === ""
                      ? "Select targets..."
                      : targets.data?.items.find((t) => t.id === targetId)
                          ?.name}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search targets..."
                    className="h-9"
                  />

                  <CommandList>
                    <CommandEmpty>No target found.</CommandEmpty>

                    <CommandGroup>
                      {targets.data?.items.map((target) => (
                        <CommandItem
                          key={target.id}
                          value={target.id}
                          onSelect={(currentValue) => {
                            setTargetId(
                              currentValue === targetId ? "" : currentValue,
                            );
                            setIsPopoverOpen(false);
                          }}
                        >
                          {target.name}
                          <IconCheck
                            className={cn(
                              "ml-auto",
                              targetId === target.id
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
              createSession(targetId);
              setModelOpen(false);
            }}
            disabled={targetId === ""}
          >
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
