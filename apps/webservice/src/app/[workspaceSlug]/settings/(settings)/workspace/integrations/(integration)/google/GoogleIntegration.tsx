"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SiGooglecloud } from "@icons-pack/react-simple-icons";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

export const GoogleIntegration: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const {
    data: integrations,
    isLoading: isLoadingIntegrations,
    refetch: refetchIntegrations,
  } = api.workspace.integrations.google.listIntegrations.useQuery(workspace.id);

  const {
    data: availableProjectIds,
    isLoading: isLoadingProjectIds,
    refetch: refetchAvailableProjectIds,
  } = api.workspace.integrations.google.listAvailableProjectIds.useQuery(
    workspace.id,
  );

  const createServiceAccount =
    api.workspace.integrations.google.createServiceAccount.useMutation();
  const deleteServiceAccount =
    api.workspace.integrations.google.deleteServiceAccount.useMutation();
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >(undefined);

  const handleCreateIntegration = () => {
    if (!selectedProjectId) return;
    createServiceAccount.mutate(
      {
        workspaceId: workspace.id,
        projectId: selectedProjectId,
      },
      {
        onSuccess: () => {
          toast.success(`Integration added for project ${selectedProjectId}`);
          setSelectedProjectId(undefined);
          refetchIntegrations();
          refetchAvailableProjectIds();
          router.refresh();
        },
        onError: (error) => {
          toast.error(`Failed to add integration: ${error.message}`);
        },
      },
    );
  };

  const handleDeleteIntegration = (projectId: string) => {
    deleteServiceAccount.mutate(
      {
        workspaceId: workspace.id,
        projectId,
      },
      {
        onSuccess: () => {
          toast.success(`Integration deleted for project ${projectId}`);
          refetchIntegrations();
          refetchAvailableProjectIds();
          router.refresh();
        },
        onError: (error) => {
          toast.error(`Failed to delete integration: ${error.message}`);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-4">
        <SiGooglecloud className="h-14 w-14 text-red-400" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Google Cloud Integration</h1>
          <p className="text-sm text-muted-foreground">
            Sync deployment targets, trigger google workflows and more.
          </p>
        </div>
      </div>

      <div className="flex w-[768px] flex-col gap-12">
        <Card className="flex flex-col rounded-md">
          <div className="flex items-center justify-between gap-5 rounded-md p-4">
            <div className="flex flex-grow flex-col gap-1">
              <h2 className="mb-4 text-xl font-semibold">
                Add New Integration
              </h2>
              <div className="flex gap-2">
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a Google Cloud Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingProjectIds ? (
                      <SelectItem value="loading" disabled>
                        Loading projects...
                      </SelectItem>
                    ) : availableProjectIds &&
                      availableProjectIds.length > 0 ? (
                      availableProjectIds.map((projectId) => (
                        <SelectItem key={projectId} value={projectId}>
                          {projectId}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No projects available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCreateIntegration}
                  disabled={
                    !selectedProjectId || createServiceAccount.isPending
                  }
                >
                  {createServiceAccount.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-border" />

          <div className="p-4">
            <h2 className="mb-4 text-xl font-semibold">
              Existing Integrations
            </h2>
            {isLoadingIntegrations ? (
              <p>Loading integrations...</p>
            ) : integrations && integrations.length > 0 ? (
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <Card key={integration.id} className="p-4">
                    <div className="flex items-center justify-between gap-5">
                      <div>
                        <p className="font-semibold">{integration.projectId}</p>
                        <p className="text-sm text-muted-foreground">
                          {integration.serviceAccountEmail}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          handleDeleteIntegration(integration.projectId)
                        }
                        disabled={deleteServiceAccount.isPending}
                      >
                        {deleteServiceAccount.isPending
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p>No integrations found. Add a new integration above.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
