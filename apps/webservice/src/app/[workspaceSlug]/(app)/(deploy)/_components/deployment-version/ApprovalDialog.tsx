"use client";

import type * as schema from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconSelector, IconX } from "@tabler/icons-react";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const EnvironmentCombobox: React.FC<{
  allEnvironments: schema.Environment[];
  selectedEnvironmentIds: string[];
  onSelect: (environmentId: string[]) => void;
  onRemove: (environmentId: string) => void;
}> = ({ allEnvironments, selectedEnvironmentIds, onSelect, onRemove }) => {
  const unselectedEnvironments = allEnvironments.filter(
    (environment) => !selectedEnvironmentIds.includes(environment.id),
  );

  const selectedEnvironments = allEnvironments.filter((environment) =>
    selectedEnvironmentIds.includes(environment.id),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-0.5">
        <Label>Environments</Label>
        <p className="text-xs text-muted-foreground">
          Select the environments to approve the release for.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {selectedEnvironments.map((environment) => (
          <Badge
            key={environment.id}
            variant="secondary"
            className="flex max-w-36 items-center gap-1 truncate text-xs"
          >
            {environment.name}
            <Button
              variant="ghost"
              size="icon"
              className="h-3 w-3 focus-visible:ring-0"
              onClick={() => onRemove(environment.id)}
            >
              <IconX className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex w-40 items-center gap-1"
            size="sm"
          >
            <IconSelector className="h-3 w-3" />
            Select environments
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-1" side="bottom" align="start">
          <Command>
            <CommandInput placeholder="Search environments..." />
            <CommandList>
              <CommandItem
                value="All"
                onSelect={() => onSelect(allEnvironments.map((e) => e.id))}
              >
                <span className="text-sm">All environments</span>
              </CommandItem>
              {unselectedEnvironments.map((environment) => (
                <CommandItem
                  key={environment.id}
                  value={environment.name}
                  onSelect={() => onSelect([environment.id])}
                >
                  <span className="text-sm">{environment.name}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const ApprovalDialogControl: React.FC<{
  versionId: string;
  environments: schema.Environment[];
  environmentId: string;
  onSubmit: () => void;
  onCancel: () => void;
}> = ({ versionId, environments, environmentId, onSubmit, onCancel }) => {
  const [environmentIds, setEnvironmentIds] = useState<string[]>([
    environmentId,
  ]);

  const router = useRouter();
  const [reason, setReason] = useState("");

  const addRecord = api.policy.approval.addRecord.useMutation();
  const handleSubmit = (status: SCHEMA.ApprovalStatus) =>
    addRecord
      .mutateAsync({
        deploymentVersionId: versionId,
        environmentIds,
        status,
        reason,
      })
      .then(() => onSubmit())
      .then(() => router.refresh());

  const setEnvironmentSelected = (environmentIds: string[]) =>
    setEnvironmentIds((prev) => [...prev, ...environmentIds]);

  const setEnvironmentUnselected = (environmentId: string) =>
    setEnvironmentIds((prev) => prev.filter((id) => id !== environmentId));

  return (
    <div className="space-y-6">
      <EnvironmentCombobox
        allEnvironments={environments}
        selectedEnvironmentIds={environmentIds}
        onSelect={setEnvironmentSelected}
        onRemove={setEnvironmentUnselected}
      />

      <div className="space-y-2">
        <div className="space-y-0.5">
          <Label>Reason</Label>
          <p className="text-xs text-muted-foreground">
            Provide a reason for the approval or rejection (optional).
          </p>
        </div>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <DialogFooter className="flex w-full flex-row items-center justify-between sm:justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit(SCHEMA.ApprovalStatus.Rejected)}
            disabled={addRecord.isPending}
          >
            Reject
          </Button>
          <Button
            onClick={() => handleSubmit(SCHEMA.ApprovalStatus.Approved)}
            disabled={addRecord.isPending}
          >
            Approve
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
};

export const ApprovalDialog: React.FC<{
  versionId: string;
  versionTag: string;
  systemId: string;
  environmentId: string;
  children: React.ReactNode;
  onSubmit?: () => void;
}> = ({
  versionId,
  versionTag,
  systemId,
  environmentId,
  children,
  onSubmit,
}) => {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = api.environment.bySystemId.useQuery(systemId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {isLoading && (
        <DialogContent>
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-4 w-4 animate-spin" />
          </div>
        </DialogContent>
      )}
      {!isLoading && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="max-w-96 truncate">
              Approve Version {versionTag}
            </DialogTitle>
          </DialogHeader>

          <ApprovalDialogControl
            versionId={versionId}
            environments={data ?? []}
            environmentId={environmentId}
            onSubmit={() => {
              setOpen(false);
              onSubmit?.();
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
};
