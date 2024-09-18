import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { TargetGroupsTable } from "./TargetGroupTable";
import { TargetLabelGroupsGettingStarted } from "./TargetLabelGroupsGettingStarted";
import { UpsertLabelGroupDialog } from "./UpsertLabelGroupDialog";

export default async function TargetLabelGroupPages({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  const labelGroups = await api.target.labelGroup.groups(workspace.id);
  if (labelGroups.length === 0)
    return <TargetLabelGroupsGettingStarted workspace={workspace} />;

  return (
    <div>
      <div className="flex items-center gap-3 border-b p-4 px-8 text-xl">
        <div className="flex flex-grow items-center gap-2">
          <span>Groups</span>
        </div>
        <UpsertLabelGroupDialog workspaceId={workspace.id} create>
          <Button variant="outline">Create Group</Button>
        </UpsertLabelGroupDialog>
      </div>

      <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-120px)] overflow-auto">
        <TargetGroupsTable workspace={workspace} labelGroups={labelGroups} />
      </div>
    </div>
  );
}
