"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";
import { AwsDialog } from "./aws/AwsDialog";

type AwsActionButtonProps = {
  workspace: Workspace;
};

export const AwsActionButton: React.FC<AwsActionButtonProps> = ({
  workspace,
}) => {
  const createAwsRole =
    api.workspace.integrations.aws.createAwsRole.useMutation();

  const router = useRouter();
  if (workspace.awsRoleArn != null)
    return (
      <AwsDialog workspace={workspace}>
        <Button variant="outline" size="sm" className="w-full">
          Configure
        </Button>
      </AwsDialog>
    );

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={createAwsRole.isPending}
      onClick={async () =>
        createAwsRole
          .mutateAsync(workspace.id)
          .then(() => toast.success(`AWS role arn created`))
          .then(() => router.refresh())
          .catch((error) => {
            toast.error(`Failed to create role arn. ${error.message}`);
          })
      }
    >
      Enable
    </Button>
  );
};
