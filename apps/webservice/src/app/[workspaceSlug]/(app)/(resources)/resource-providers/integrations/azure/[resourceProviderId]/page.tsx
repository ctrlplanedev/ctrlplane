import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBrandAzure, IconExternalLink } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";

import { env } from "~/env";
import { api } from "~/trpc/server";
import { PermissionsButton } from "./PermissionsButton";

type Params = { resourceProviderId: string };

const azureAppClientId = env.AZURE_APP_CLIENT_ID;

export default async function AzureProviderPage({
  params,
}: {
  params: Params;
}) {
  if (azureAppClientId == null) return notFound();

  const { resourceProviderId } = params;

  const provider =
    await api.resource.provider.managed.azure.byProviderId(resourceProviderId);
  if (provider == null) return notFound();

  const portalUrl = `https://portal.azure.com/#@${provider.azure_tenant.tenantId}/resource/subscriptions/${provider.resource_provider_azure.subscriptionId}/users`;
  const applicationPortalUrl = `https://portal.azure.com/#@${provider.azure_tenant.tenantId}/blade/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/Overview/appId/${azureAppClientId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <IconBrandAzure className="h-6 w-6 text-blue-500" /> Next steps
        </h1>
        <p className="text-sm text-muted-foreground">
          To allow Ctrlplane to scan your Azure resources, you need to grant the
          Azure service principal the necessary permissions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">
            Step 1: Go to Access Control (IAM) in the Azure portal
          </h2>
          <Link
            href={portalUrl}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex w-fit items-center gap-2",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconExternalLink className="h-4 w-4" /> Go to IAM
          </Link>
        </div>
        <h2 className="text-lg font-medium">
          Step 2: Click "Add role assignment"
        </h2>
        <div className="space-y-2">
          <h2 className="text-lg font-medium">
            Step 3: Configure the role assignment
          </h2>
          <h3 className="text-sm font-medium text-muted-foreground">
            a. In the "Role" tab, select "Reader"
          </h3>
          <h3 className="text-sm font-medium text-muted-foreground">
            b. In the "Members" tab, first make sure "User, group, or service
            principal" is selected.
          </h3>
          <h3 className="text-sm font-medium text-muted-foreground">
            c. Click "Select members" and search for the application you
            consented to by name. It can be found on this{" "}
            <Link
              href={applicationPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              page
            </Link>
            , listed as the "Display name".
          </h3>
          <h3 className="text-sm font-medium text-muted-foreground">
            d. In the "Review + assign", confirm the assignment, then click
            "Review + assign" at the bottom.
          </h3>
        </div>
        <h2 className="text-lg font-medium">
          Step 4: Once assigned, click "Permissions Granted"
        </h2>
        <PermissionsButton resourceProviderId={resourceProviderId} />
      </div>
    </div>
  );
}
