import { notFound } from "next/navigation";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { api } from "~/trpc/server";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { VariableSetGettingStarted } from "./GettingStartedVariableSets";
import { VariableSetsTable } from "./VariableSetsTable";

export default async function SystemVariableSetsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace
    .bySlug(params.workspaceSlug)
    .catch(() => notFound());
  if (!workspace) notFound();
  const system = await api.system.bySlug(params).catch(() => notFound());

  const variableSets = await api.variableSet.bySystemId(system.id);
  return (
    <div>
      <PageHeader>
        <SystemBreadcrumb system={system} page="Variables" />
      </PageHeader>

      {variableSets.length === 0 && (
        <VariableSetGettingStarted
          systemId={system.id}
          environments={system.environments}
        />
      )}
      {variableSets.length !== 0 && (
        <VariableSetsTable variableSets={variableSets} />
      )}
    </div>
  );
}
