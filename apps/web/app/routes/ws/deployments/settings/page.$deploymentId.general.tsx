import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { CopyButton } from "~/components/ui/copy-button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useDeployment } from "../_components/DeploymentProvider";

export default function DeploymentsSettingsPage() {
  const { deployment } = useDeployment();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your deployment settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployment ID</CardTitle>
          <CardDescription>Your deployment's unique identifier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="deployment-id">ID</Label>
              <Input
                id="deployment-id"
                type="text"
                value={deployment.id}
                readOnly
                className="font-mono"
              />
            </div>
            <CopyButton textToCopy={deployment.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
