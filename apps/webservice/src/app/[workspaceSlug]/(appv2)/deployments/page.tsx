import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { DeploymentsCard } from "../_components/deployments/Card";
import { CreateDeploymentDialog } from "../_components/deployments/CreateDeployment";

export const metadata: Metadata = {
  title: "Deployments | Ctrlplane",
};

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function DeploymentsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div className="container m-8 mx-auto space-y-8">
      <div className="flex w-full justify-between">
        <h2 className="text-2xl font-bold">Deployments</h2>
        <CreateDeploymentDialog>
          <Button variant="outline" size="sm">
            Create Deployment
          </Button>
        </CreateDeploymentDialog>
      </div>
      <DeploymentsCard workspaceId={workspace.id} />
    </div>
  );
}
