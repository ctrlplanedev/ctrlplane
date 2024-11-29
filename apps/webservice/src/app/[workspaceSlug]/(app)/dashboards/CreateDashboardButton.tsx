"use client";

import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

export const CreateDashboardButton: React.FC<{
  workspace: { id: string; slug: string };
}> = ({ workspace }) => {
  const createDashboard = api.dashboard.create.useMutation();
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        const ds = await createDashboard.mutateAsync({
          name: "New Dashboard",
          description: "New Dashboard",
          workspaceId: workspace.id,
        });
        router.push(`/${workspace.slug}/dashboards/${ds.id}`);
      }}
    >
      Create Dashboard
    </Button>
  );
};
