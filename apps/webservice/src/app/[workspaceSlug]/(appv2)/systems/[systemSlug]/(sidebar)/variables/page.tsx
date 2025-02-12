import { notFound } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { CreateVariableSetDialog } from "./CreateVariableSetDialog";
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
        <SidebarTrigger />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>Variables</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex-grow" />
        <CreateVariableSetDialog
          systemId={system.id}
          environments={system.environments}
        >
          <Button size="sm" variant="outline">
            Create Variable Set
          </Button>
        </CreateVariableSetDialog>
      </PageHeader>

      {variableSets.length === 0 && (
        <VariableSetGettingStarted
          systemId={system.id}
          environments={system.environments}
        />
      )}
      {variableSets.length !== 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-110px)] overflow-auto">
          <VariableSetsTable variableSets={variableSets} />
        </div>
      )}
    </div>
  );
}
