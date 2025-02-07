import type { Metadata } from "next";
import React from "react";
import { notFound } from "next/navigation";
import { SiAmazon, SiGooglecloud } from "@icons-pack/react-simple-icons";
import { IconBrandAzure } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";

import { env } from "~/env";
import { api } from "~/trpc/server";
import { AwsActionButton } from "./AwsActionButton";
import { CreateAzureProviderDialog } from "./azure/CreateAzureProviderDialog";
import { GoogleActionButton } from "./GoogleActionButton";
import { selfManagedAgents } from "./SelfManaged";

export const metadata: Metadata = {
  title: "Resource Integrations | Ctrlplane",
};

const Badge: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div
    className={cn(
      "inline-block rounded-full bg-neutral-500/20 px-2 text-xs text-neutral-300",
      className,
    )}
  >
    {children}
  </div>
);

const K8sBadge: React.FC = () => (
  <Badge className="bg-blue-500/20 text-blue-300">Kubernetes</Badge>
);

const VmBadge: React.FC = () => (
  <Badge className="bg-green-500/20 text-green-300">VM</Badge>
);

const VpcBadge: React.FC = () => (
  <Badge className="bg-neutral-500/20 text-neutral-300">VPC</Badge>
);

const ResourceProviderCard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Card className="flex h-full flex-col justify-between space-y-4 p-4 text-center">
    {children}
  </Card>
);

const ResourceProviderContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-2">{children}</div>;

const ResourceProviderActionButton: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Button variant="outline" size="sm" className="block w-full">
    {children}
  </Button>
);

const ResourceProviderHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-1">{children}</div>;

const ResourceProviderBadges: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-x-1">{children}</div>;

const ResourceProviders: React.FC<{ workspaceSlug: string }> = async ({
  workspaceSlug,
}) => {
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const azureAppClientId = env.AZURE_APP_CLIENT_ID;
  return (
    <div className="h-full overflow-y-auto p-8 pb-24">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-semibold">Managed Resource Providers</h2>
        <p className="text-sm text-muted-foreground">
          Resource providers built into Ctrlplane that don't require you to run
          anything.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          <ResourceProviderCard>
            <ResourceProviderContent>
              <ResourceProviderHeading>
                <SiAmazon className="mx-auto text-4xl text-orange-300" />
                <div className="font-semibold">Amazon</div>
              </ResourceProviderHeading>
              <p className="text-xs text-muted-foreground">
                Grant our account the correct permissions and we will manage
                running the resource provider for you.
              </p>

              <ResourceProviderBadges>
                <K8sBadge />
              </ResourceProviderBadges>
            </ResourceProviderContent>

            <AwsActionButton workspace={workspace} />
          </ResourceProviderCard>

          <ResourceProviderCard>
            <ResourceProviderContent>
              <ResourceProviderHeading>
                <SiGooglecloud className="mx-auto text-4xl text-red-400" />
                <div className="font-semibold">Google</div>
              </ResourceProviderHeading>
              <p className="text-xs text-muted-foreground">
                Grant our service account permissions and we will manage running
                the resource provider for you.
              </p>
              <ResourceProviderBadges>
                <K8sBadge />
                <VmBadge />
                <VpcBadge />
              </ResourceProviderBadges>
            </ResourceProviderContent>

            <GoogleActionButton workspace={workspace} />
          </ResourceProviderCard>

          {azureAppClientId != null && (
            <ResourceProviderCard>
              <ResourceProviderContent>
                <ResourceProviderHeading>
                  <IconBrandAzure className="mx-auto text-4xl text-blue-400" />
                  <div className="font-semibold">Azure</div>
                </ResourceProviderHeading>
                <p className="text-xs text-muted-foreground">
                  Grant our Azure application permissions and we will manage
                  running the resource provider for you.
                </p>
                <ResourceProviderBadges>
                  <K8sBadge />
                </ResourceProviderBadges>
              </ResourceProviderContent>

              <CreateAzureProviderDialog workspaceId={workspace.id} />
            </ResourceProviderCard>
          )}
        </div>

        <div className="my-16 border-b" />

        <h2 className="font-semibold">Self-hosted Resource Providers</h2>
        <p className="text-sm text-muted-foreground">
          Resource providers that you run in your own infrastructure, these
          resource providers will automatically register themselves with
          Ctrlplane.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          {selfManagedAgents.map((agent) => {
            const { name, description, icon, instructions } = agent(workspace);
            return (
              <ResourceProviderCard key={name}>
                <ResourceProviderContent>
                  <ResourceProviderHeading>
                    {icon}
                    <div className="font-semibold">{name}</div>
                  </ResourceProviderHeading>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </ResourceProviderContent>

                <div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <ResourceProviderActionButton>
                        Instructions
                      </ResourceProviderActionButton>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Setup Instructions</DialogTitle>
                      </DialogHeader>
                      {instructions}
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            Close
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </ResourceProviderCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default async function ResourceProviderIntegrationsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  return <ResourceProviders workspaceSlug={params.workspaceSlug} />;
}
