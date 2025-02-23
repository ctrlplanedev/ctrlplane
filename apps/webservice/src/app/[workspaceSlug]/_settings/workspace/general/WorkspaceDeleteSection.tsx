import { Button } from "@ctrlplane/ui/button";

export const WorkspaceDeleteSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>Delete workspace</div>

      <div className="text-xs text-muted-foreground">
        If you want to permanently delete this workspace and all of its data,
        including but not limited to users, deployments, resources, you can do
        so below.
      </div>

      <Button variant="destructive" disabled>
        Delete this workspace
      </Button>
    </div>
  );
};
