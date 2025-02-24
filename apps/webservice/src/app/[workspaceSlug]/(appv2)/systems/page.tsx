import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { CreateDeploymentDialog } from "../_components/deployments/CreateDeployment";
import { SystemDeploymentTable } from "./SystemDeploymentTable";

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  const systems = await api.system.list({
    workspaceId: workspace.id,
  });

  return (
    <div className="container m-8 mx-auto space-y-8">
      <div className="flex w-full items-center justify-between">
        <h2 className="text-2xl font-bold">Systems</h2>
        <CreateDeploymentDialog>
          <Button variant="outline">Create Deployment</Button>
        </CreateDeploymentDialog>
      </div>

      {systems.items.map((s) => (
        <SystemDeploymentTable key={s.id} workspace={workspace} system={s} />
      ))}
    </div>
  );
}
