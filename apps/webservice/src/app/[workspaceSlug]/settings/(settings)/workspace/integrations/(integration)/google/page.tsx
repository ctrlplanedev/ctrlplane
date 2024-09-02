"use client";

import { SiGooglecloud } from "react-icons/si";

import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

export default function GoogleIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

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

      <Card className="flex items-center justify-between rounded-md p-4"></Card>
    </div>
  );
}
