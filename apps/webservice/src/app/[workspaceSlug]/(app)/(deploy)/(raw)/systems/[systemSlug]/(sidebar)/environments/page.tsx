import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { CreateEnvironmentDialog } from "./CreateEnvironmentDialog";
import { EnvironmentRow } from "./EnvironmentRow";

export default async function EnvironmentsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => null);
  if (system == null) notFound();

  const environments = await api.environment.bySystemId(system.id);

  return (
    <div>
      <PageHeader className="justify-between">
        <SystemBreadcrumb system={system} page="Environments" />
        <CreateEnvironmentDialog systemId={system.id}>
          <Button variant="outline" size="sm">
            Create Environment
          </Button>
        </CreateEnvironmentDialog>
      </PageHeader>

      {environments.map((environment) => (
        <EnvironmentRow key={environment.id} environment={environment} />
      ))}
    </div>
  );
}
