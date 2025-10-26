import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useWorkspace } from "~/components/WorkspaceProvider";

export default function DeleteWorkspacePage() {
  const { workspace } = useWorkspace();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delete Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently delete this workspace and all of its data
        </p>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Once you delete a workspace, there is no going back. Please be
            certain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
              <h3 className="mb-2 font-semibold text-destructive">
                This action will:
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Permanently delete the workspace "{workspace.name}"</li>
                <li>Delete all systems, resources, and deployments</li>
                <li>Remove all workspace members and their access</li>
                <li>Delete all API keys associated with this workspace</li>
                <li>Remove all historical data and cannot be undone</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button variant="destructive" disabled>
                Delete Workspace
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
