"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SiAmazonwebservices } from "@icons-pack/react-simple-icons";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";

export const AwsIntegration: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  const createAwsRole =
    api.workspace.integrations.aws.createAwsRole.useMutation();
  const deleteAwsRole =
    api.workspace.integrations.aws.deleteAwsRole.useMutation();
  const router = useRouter();
  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.awsRole ?? "");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const isIntegrationEnabled = workspace.awsRole != null;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-4">
        <SiAmazonwebservices className="h-14 w-14 text-orange-400" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Aws</h1>
          <p className="text-sm text-muted-foreground">
            Sync deployment resources, trigger AWS workflows and more.
          </p>
        </div>
      </div>

      <Card className="flex flex-col rounded-md">
        <div className="flex items-center justify-between gap-5 rounded-md p-4">
          <div className="flex flex-grow flex-col gap-1">
            <h2 className="text-lg font-semibold">Role</h2>

            <p className="text-sm text-muted-foreground">
              This integration creates a role that can be configured in your AWS
              accounts.
            </p>
          </div>

          {isIntegrationEnabled ? (
            <Button
              variant="outline"
              disabled={deleteAwsRole.isPending}
              onClick={() =>
                deleteAwsRole
                  .mutateAsync(workspace.id)
                  .then(() => toast.success("AWS Role deleted"))
                  .then(() => router.refresh())
                  .catch((error) => {
                    toast.error(`Failed to delete AWS role. ${error.message}`);
                  })
              }
            >
              Disable
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={createAwsRole.isPending}
              onClick={() =>
                createAwsRole
                  .mutateAsync(workspace.id)
                  .then(() => toast.success("AWS Role created"))
                  .then(() => router.refresh())
                  .catch((error) => {
                    toast.error(`Failed to create AWS role. ${error.message}`);
                  })
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
                  {workspace.awsRole}
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
