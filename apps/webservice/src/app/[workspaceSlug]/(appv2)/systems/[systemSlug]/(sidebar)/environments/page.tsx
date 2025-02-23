import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
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
        <SidebarTrigger name={Sidebars.System}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>Environments</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      {environments.map((environment) => (
        <EnvironmentRow key={environment.id} environment={environment} />
      ))}
    </div>
  );
}
