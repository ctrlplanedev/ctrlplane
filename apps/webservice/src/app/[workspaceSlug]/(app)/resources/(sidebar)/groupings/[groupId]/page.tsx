import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { CreateMetadataGroupDialog } from "../CreateMetadataGroupDialog";
import { CombinationsTable } from "./CombincationsTable";

export default async function ResourceMetadataGroupPages(props: {
  params: Promise<{ workspaceSlug: string; groupId: string }>;
}) {
  const params = await props.params;
  const { workspaceSlug, groupId } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();
  const metadataGroup = await api.resource.metadataGroup
    .byId(groupId)
    .catch(notFound);
  return (
    <div>
      <PageHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Resources}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Groupings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateMetadataGroupDialog workspaceId={workspace.id}>
          <Button variant="outline" size="sm">
            Create Metadata Group
          </Button>
        </CreateMetadataGroupDialog>
      </PageHeader>
      <div>
        <div className="flex items-center gap-3 border-b p-4 px-8 text-xl">
          <span className="">{metadataGroup.name}</span>
          <Badge
            className="rounded-full text-muted-foreground"
            variant="outline"
          >
            {metadataGroup.combinations.length}
          </Badge>
        </div>

        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-110px)] w-full overflow-auto">
          <CombinationsTable
            workspaceSlug={workspaceSlug}
            combinations={metadataGroup.combinations}
          />
        </div>
      </div>
    </div>
  );
}
