import { SiGooglecloud } from "react-icons/si";

import { Card } from "@ctrlplane/ui/card";

export const metadata = { title: "Google Integrations - Settings" };

export default function GoogleIntegrationPage() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-4">
        <SiGooglecloud className="h-14 w-14 text-red-400" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Google</h1>
          <p className="text-sm text-muted-foreground">
            Sync deployment targets, trigger google workflows and more.
          </p>
        </div>
      </div>

      <Card className="flex items-center justify-between rounded-md p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Google Cloud</h2>
          <p className="text-sm text-muted-foreground">
            Sync deployment targets, trigger google workflows and more.
          </p>
        </div>
      </Card>
    </div>
  );
}
