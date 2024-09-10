"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { TbCategory } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

import { UpsertLabelGroupDialog } from "./UpsertLabelGroupDialog";

export const TargetLabelGroupsGettingStarted: React.FC<{
  workspace: Workspace;
}> = ({ workspace }) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <TbCategory className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Target Label Groups</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Target Label Groups allow you to organize and categorize your
            targets based on specific label keys. By specifying key(s), you can
            group all matching targets and organize them by their corresponding
            values.
          </p>
          <p>
            This feature provides a powerful way to visualize and manage your
            infrastructure, allowing you to quickly identify and work with
            groups of related targets. For example, you could group targets by
            environment, region, or any other custom label you've defined.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UpsertLabelGroupDialog workspaceId={workspace.id} create>
            <Button size="sm">Create Label Group</Button>
          </UpsertLabelGroupDialog>
          <Button size="sm" variant="secondary">
            View Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
