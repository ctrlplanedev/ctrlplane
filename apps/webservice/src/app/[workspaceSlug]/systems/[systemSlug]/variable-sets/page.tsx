import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../SystemsBreadcrumb";
import { TopNav } from "../../TopNav";
import { CreateVariableSetDialog } from "./CreateVariableSetDialog";
import { VariableSetGettingStarted } from "./GettingStartedVariableSets";
import { VariableSetsTable } from "./VariableSetsTable";

export const metadata: Metadata = { title: "Variable Sets - Systems" };

export default async function SystemVariableSetsPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const workspace = await api.workspace
    .bySlug(params.workspaceSlug)
    .catch(() => notFound());
  if (!workspace) notFound();
  const system = await api.system.bySlug(params).catch(() => notFound());

  const variableSets = await api.variableSet.bySystemId(system.id);
  if (variableSets.length === 0)
    return (
      <VariableSetGettingStarted
        systemId={system.id}
        environments={system.environments}
      />
    );
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-110px)] overflow-auto">
        <div className="flex items-center gap-4 border-b p-2 pl-4">
          <h1 className="flex-grow">Variable Sets</h1>
          <CreateVariableSetDialog
            systemId={system.id}
            environments={system.environments}
          >
            <Button>Create variable set</Button>
          </CreateVariableSetDialog>
        </div>

        <VariableSetsTable variableSets={variableSets} />
      </div>
    </>
  );
}
