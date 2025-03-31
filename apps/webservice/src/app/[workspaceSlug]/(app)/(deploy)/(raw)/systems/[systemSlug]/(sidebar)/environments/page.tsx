import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { CreateEnvironmentDialog } from "./CreateEnvironmentDialog";
import { EnvironmentCard } from "./EnvironmentCard";

export const generateMetadata = async (props: {
  params: { workspaceSlug: string; systemSlug: string };
}): Promise<Metadata> => {
  try {
    const system = await api.system.bySlug(props.params);
    return {
      title: `Environments | ${system.name} | Ctrlplane`,
      description: `Manage environments for the ${system.name} system in Ctrlplane.`,
    };
  } catch {
    return {
      title: "Environments | Ctrlplane",
      description: "Manage deployment environments in Ctrlplane.",
    };
  }
};

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

      <div className="m-2 grid grid-cols-1 gap-6 p-4 md:grid-cols-2 lg:grid-cols-3">
        {environments.map((environment) => (
          <EnvironmentCard key={environment.id} environment={environment} />
        ))}

        {environments.length === 0 && (
          <div className="col-span-full flex h-32 items-center justify-center rounded-lg border border-dashed border-neutral-800">
            <p className="text-sm text-neutral-400">
              No environments found. Create your first environment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
