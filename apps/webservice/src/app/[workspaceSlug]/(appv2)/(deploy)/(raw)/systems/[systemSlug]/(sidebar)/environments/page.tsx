import { notFound } from "next/navigation";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
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
      <PageHeader>
        <SystemBreadcrumb system={system} page="Environments" />
      </PageHeader>

      {environments.map((environment) => (
        <EnvironmentRow key={environment.id} environment={environment} />
      ))}
    </div>
  );
}
