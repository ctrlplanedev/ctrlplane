import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { CreateMetadataGroupDialog } from "./CreateMetadataGroupDialog";
import { ResourceGroupsTable } from "./ResourceGroupTable";
import { ResourceMetadataGroupsGettingStarted } from "./ResourceMetadataGroupsGettingStarted";

export default async function ResourceMetadataGroupPages(
  props: {
    params: Promise<{ workspaceSlug: string }>;
  }
) {
  const params = await props.params;
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const metadataGroups = await api.resource.metadataGroup.groups(workspace.id);
  if (metadataGroups.length === 0)
    return <ResourceMetadataGroupsGettingStarted workspace={workspace} />;

  return (
    <div>
      <div className="flex items-center gap-3 border-b p-4 px-8 text-xl">
        <div className="flex flex-grow items-center gap-2">
          <span>Groups</span>
        </div>
        <CreateMetadataGroupDialog workspaceId={workspace.id}>
          <Button variant="outline">Create Group</Button>
        </CreateMetadataGroupDialog>
      </div>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-120px)] overflow-auto">
        <ResourceGroupsTable
          workspace={workspace}
          metadataGroups={metadataGroups}
        />
      </div>
    </div>
  );
}
