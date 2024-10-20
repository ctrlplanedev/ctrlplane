"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { GoogleDialog } from "./google/GoogleDialog";

type GoogleActionButtonProps = {
  workspace: Workspace;
};

export const GoogleActionButton: React.FC<GoogleActionButtonProps> = ({
  workspace,
}) => {
  const { data: integrations, isLoading } =
    api.workspace.integrations.google.listIntegrations.useQuery(workspace.id);

  const router = useRouter();

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" className="w-full" disabled>
        Loading...
      </Button>
    );
  }

  if (integrations && integrations.length > 0) {
    return (
      <GoogleDialog workspace={workspace}>
        <Button variant="outline" size="sm" className="w-full">
          Configure
        </Button>
      </GoogleDialog>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() =>
        router.push(`/${workspace.slug}/settings/workspace/integrations/google`)
      }
    >
      Enable
    </Button>
  );
};
