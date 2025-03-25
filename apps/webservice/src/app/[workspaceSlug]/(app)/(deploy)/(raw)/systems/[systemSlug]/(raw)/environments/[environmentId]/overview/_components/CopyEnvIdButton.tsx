"use client";

import React from "react";
import { IconCopy } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";

export const CopyEnvIdButton: React.FC<{
  environmentId: string;
}> = ({ environmentId }) => {
  const copyEnvironmentId = () => {
    navigator.clipboard.writeText(environmentId);
    toast.success("Environment ID copied", {
      description: environmentId,
      duration: 2000,
    });
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 rounded-full hover:bg-neutral-800/50"
      onClick={(e) => {
        e.preventDefault();
        copyEnvironmentId();
      }}
      title="Copy environment ID"
    >
      <IconCopy className="h-3 w-3" />
    </Button>
  );
};
