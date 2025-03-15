"use client";

import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

export const DeleteGithubUserButton: React.FC<{ githubUserId: string }> = ({
  githubUserId,
}) => {
  const deleteGithubUser = api.github.user.delete.useMutation();
  const router = useRouter();

  const handleDelete = () =>
    deleteGithubUser.mutateAsync(githubUserId).then(() => router.refresh());

  return (
    <Button variant="secondary" onClick={handleDelete}>
      Disconnect
    </Button>
  );
};
