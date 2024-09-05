"use client";

import React, { useState } from "react";
import { notFound } from "next/navigation";
import { SiGooglecloud } from "react-icons/si";
import { TbCheck, TbCopy, TbLoader2 } from "react-icons/tb";
import { useCopyToClipboard } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

export const GoogleIntegration: React.FC<{
  workspaceSlug: string;
}> = ({ workspaceSlug }) => {
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const createServiceAccount =
    api.workspace.integrations.google.createServiceAccount.useMutation();
  const utils = api.useUtils();
  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.data?.googleServiceAccountEmail ?? "");
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  if (workspace.isSuccess && workspace.data == null) return notFound();

  const isIntegrationEnabled =
    workspace.data?.googleServiceAccountEmail != null;

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

      {workspace.isLoading && (
        <div className="flex items-center justify-center">
          <TbLoader2 className="h-10 w-10 animate-spin" />
        </div>
      )}

      {!workspace.isLoading && (
        <>
          <Card className="flex flex-col rounded-md">
            <div className="flex items-center justify-between gap-5 rounded-md p-4">
              <div className="flex flex-grow flex-col gap-1">
                <h2 className="text-lg font-semibold">Service Account</h2>

                <p className="text-sm text-muted-foreground">
                  This integration creates a service account that can be invited
                  to your google projects.
                </p>
              </div>

              {isIntegrationEnabled ? (
                <Button variant="outline">Disable</Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    createServiceAccount
                      .mutateAsync(workspace.data?.id ?? "")
                      .then(() => utils.workspace.bySlug.invalidate())
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
                    <span className="w-64 truncate">
                      {workspace.data?.googleServiceAccountEmail}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleCopy}>
                      {isCopied ? (
                        <TbCheck className="h-3 w-3 text-green-500" />
                      ) : (
                        <TbCopy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Connected</span>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
