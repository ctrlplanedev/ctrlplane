"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";
import { GoogleDialog } from "./google/GoogleDialog";

type GoogleActionButtonProps = {
  workspace: Workspace;
};

export const GoogleActionButton: React.FC<GoogleActionButtonProps> = ({
  workspace,
}) => {
  const createServiceAccount =
    api.workspace.integrations.google.createServiceAccount.useMutation();

  const router = useRouter();
  if (workspace.googleServiceAccountEmail != null)
    return (
      <GoogleDialog workspace={workspace}>
        <Button variant="outline" size="sm" className="w-full">
          Configure
        </Button>
      </GoogleDialog>
    );

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={createServiceAccount.isPending}
      onClick={async () =>
        createServiceAccount
          .mutateAsync(workspace.id)
          .then((result) =>
            toast.success(
              `Google Service Account ${result.googleServiceAccountEmail} created for ${result.name}`,
            ),
          )
          .then(() => router.refresh())
          .catch((error) => {
            toast.error(
              `Failed to create Google Service Account. ${error.message}`,
            );
          })
      }
    >
      Enable
    </Button>
  );
};
