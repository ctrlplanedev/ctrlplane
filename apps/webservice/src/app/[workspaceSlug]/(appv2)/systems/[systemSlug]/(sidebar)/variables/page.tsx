import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

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
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
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
        <SidebarTrigger name={Sidebars.System}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
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
        <VariableSetsTable variableSets={variableSets} />
      )}
    </div>
  );
}
