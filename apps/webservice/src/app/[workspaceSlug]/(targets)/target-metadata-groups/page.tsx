import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { TargetGroupsTable } from "./TargetGroupTable";
import { TargetMetadataGroupsGettingStarted } from "./TargetMetadataGroupsGettingStarted";
import { UpsertMetadataGroupDialog } from "./UpsertMetadataGroupDialog";

export default async function TargetMetadataGroupPages({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const metadataGroups = await api.target.metadataGroup.groups(workspace.id);
  if (metadataGroups.length === 0)
    return <TargetMetadataGroupsGettingStarted workspace={workspace} />;

  return (
    <div>
      <div className="flex items-center gap-3 border-b p-4 px-8 text-xl">
        <div className="flex flex-grow items-center gap-2">
          <span>Groups</span>
        </div>
        <UpsertMetadataGroupDialog workspaceId={workspace.id} create>
          <Button variant="outline">Create Group</Button>
        </UpsertMetadataGroupDialog>
      </div>

      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-120px)] overflow-auto">
        <TargetGroupsTable
          workspace={workspace}
          metadataGroups={metadataGroups}
        />
      </div>
    </div>
  );
}
