import Link from "next/link";
import { notFound } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";

type Params = { resourceProviderId: string };

export default async function AzureProviderPage({
  params,
}: {
  params: Params;
}) {
  const { resourceProviderId } = params;

  const provider =
    await api.resource.provider.managed.azure.byProviderId(resourceProviderId);

  if (provider == null) return notFound();

  const portalUrl = `https://portal.azure.com/#@${provider.azure_tenant.tenantId}/resource/subscriptions/${provider.resource_provider_azure.subscriptionId}/users`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Next steps</h1>
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
          <h3></h3>
        </div>
      </div>
    </div>
  );
}
