"use client";

import { useParams, useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

type PermissionsButtonProps = {
  resourceProviderId: string;
};

export const PermissionsButton: React.FC<PermissionsButtonProps> = ({
  resourceProviderId,
}) => {
  const router = useRouter();
  const sync = api.resource.provider.managed.sync.useMutation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const handleClick = async () => {
    await sync
      .mutateAsync(resourceProviderId)
      .then(() => router.push(`/${workspaceSlug}/resource-providers`));
  };

  return (
    <Button onClick={handleClick} disabled={sync.isPending}>
      Permissions granted
    </Button>
  );
};