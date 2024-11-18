"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SiGooglecloud } from "@icons-pack/react-simple-icons";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

export const GoogleIntegration: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const createServiceAccount =
    api.workspace.integrations.google.createServiceAccount.useMutation();
  const deleteServiceAccount =
    api.workspace.integrations.google.deleteServiceAccount.useMutation();
  const router = useRouter();
  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.googleServiceAccountEmail ?? "");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const isIntegrationEnabled = workspace.googleServiceAccountEmail != null;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-4">
        <SiGooglecloud className="h-14 w-14 text-red-400" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Google</h1>
          <p className="text-sm text-muted-foreground">
            Sync deployment targets, trigger google workflows and more.
          </p>
        </div>
      </div>

      <Card className="flex flex-col rounded-md">
        <div className="flex items-center justify-between gap-5 rounded-md p-4">
          <div className="flex flex-grow flex-col gap-1">
            <h2 className="text-lg font-semibold">Service Account</h2>

            <p className="text-sm text-muted-foreground">
              This integration creates a service account that can be invited to
              your google projects.
            </p>
          </div>

          {isIntegrationEnabled ? (
            <Button
              variant="outline"
              disabled={deleteServiceAccount.isPending}
              onClick={() =>
                deleteServiceAccount
                  .mutateAsync(workspace.id)
                  .then(() => router.refresh())
              }
            >
              Disable
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={createServiceAccount.isPending}
              onClick={() =>
                createServiceAccount
                  .mutateAsync(workspace.id)
                  .then(() => router.refresh())
              }
            >
              Enable
            </Button>
          )}
        </div>

        {isIntegrationEnabled && (
          <>
            <div className="h-px w-full bg-border" />

            <div className="flex items-center justify-between p-4 text-sm text-neutral-200">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-xs">
                  {workspace.googleServiceAccountEmail}
                </span>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {isCopied ? (
                    <IconCheck className="h-3 w-3 text-green-500" />
                  ) : (
                    <IconCopy className="h-3 w-3" />
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span>Enabled</span>
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
