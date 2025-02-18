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
import { DeleteSystemDialog } from "./DeleteSystemDialog";
import { GeneralSettings } from "./GeneralSettings";

export default async function SystemSettingsPage(props: {
  params: Promise<{ workspaceSlug: string; systemSlug: string }>;
}) {
  const params = await props.params;
  const system = await api.system.bySlug(params).catch(() => notFound());
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
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="container mx-auto h-full max-w-2xl space-y-8 overflow-y-auto p-8 py-16 pb-24">
        <div className="space-y-3">
          <div>General</div>
          <GeneralSettings system={system} />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-red-500">Danger Zone</div>

          <div className="text-sm text-muted-foreground">
            Permanently delete this system and all of its data. This action
            cannot be undone.
          </div>

          <DeleteSystemDialog system={system}>
            <Button variant="destructive">Delete System</Button>
          </DeleteSystemDialog>
        </div>
      </div>
    </div>
  );
}
