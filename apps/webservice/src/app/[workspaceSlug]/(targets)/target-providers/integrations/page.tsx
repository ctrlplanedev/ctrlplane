import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SiAmazon,
  SiGooglecloud,
  SiKubernetes,
  SiMicrosoftazure,
  SiTerraform,
} from "react-icons/si";
import { TbSettings } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/server";
import { GoogleDialog } from "./google/GoogleDialog";

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
  <Badge className="bg-blue-500/20 text-blue-300">KubernetesAPI</Badge>
);

const TargetProviderCard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Card className="flex h-full flex-col justify-between space-y-4 p-4 text-center">
    {children}
  </Card>
);

const TargetProviderContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-2">{children}</div>;

const TargetProviderActionButton: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Button variant="outline" size="sm" className="block w-full">
    {children}
  </Button>
);

const TargetProviderHeading: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-1">{children}</div>;

const TargetProviderBadges: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-x-1">{children}</div>;

const TargetProviders: React.FC<{ workspaceSlug: string }> = async ({
  workspaceSlug,
}) => {
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  return (
    <div className="h-full overflow-y-auto p-8 pb-24">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-semibold">Managed Target Providers</h2>
        <p className="text-sm text-muted-foreground">
          Target providers built into Ctrlplane that don't require you to run
          anything.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          <TargetProviderCard>
            <TargetProviderContent>
              <TargetProviderHeading>
                <SiAmazon className="mx-auto text-4xl text-orange-300" />
                <div className="font-semibold">Amazon</div>
              </TargetProviderHeading>
              <p className="text-xs text-muted-foreground">
                Grant our account the correct permissions and we will manage
                running the target provider for you.
              </p>

              <TargetProviderBadges>
                <K8sBadge />
              </TargetProviderBadges>
            </TargetProviderContent>

            <TargetProviderActionButton>Configure</TargetProviderActionButton>
          </TargetProviderCard>

          <TargetProviderCard>
            <TargetProviderContent>
              <TargetProviderHeading>
                <SiGooglecloud className="mx-auto text-4xl text-red-400" />
                <div className="font-semibold">Google</div>
              </TargetProviderHeading>
              <p className="text-xs text-muted-foreground">
                Grant our service account permissions and we will manage running
                the target provider for you.
              </p>
              <TargetProviderBadges>
                <K8sBadge />
              </TargetProviderBadges>
            </TargetProviderContent>

            <div>
              {workspace.googleServiceAccountEmail != null ? (
                <GoogleDialog>
                  <Button variant="outline" size="sm" className="w-full">
                    Configure
                  </Button>
                </GoogleDialog>
              ) : (
                <Button variant="outline" size="sm" className="w-full">
                  <Link
                    href={`/${workspaceSlug}/settings/workspace/integrations/google`}
                  >
                    Enable
                  </Link>
                </Button>
              )}
            </div>
          </TargetProviderCard>

          <TargetProviderCard>
            <TargetProviderContent>
              <TargetProviderHeading>
                <SiMicrosoftazure className="mx-auto text-4xl text-blue-400" />
                <div className="font-semibold">Azure</div>
              </TargetProviderHeading>
              <p className="text-xs text-muted-foreground">
                Grant our service account permissions and we will manage running
                the target provider for you.
              </p>
              <TargetProviderBadges>
                <K8sBadge />
              </TargetProviderBadges>
            </TargetProviderContent>

            <div>
              <Button variant="outline" size="sm" className="w-full">
                Configure
              </Button>
            </div>
          </TargetProviderCard>
        </div>

        <div className="my-16 border-b" />

        <h2 className="font-semibold">Self-hosted Target Providers</h2>
        <p className="text-sm text-muted-foreground">
          Target providers that you run in your own infrastructure, these target
          providers will automatically register themselves with Ctrlplane.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-6">
          <TargetProviderCard>
            <TargetProviderContent>
              <TargetProviderHeading>
                <TbSettings className="mx-auto text-4xl" />
                <div className="font-semibold">Custom</div>
              </TargetProviderHeading>
              <p className="text-xs text-muted-foreground">
                Create custom target providers to import resources.
              </p>
              <TargetProviderBadges>
                <Badge>Open API</Badge>
              </TargetProviderBadges>
            </TargetProviderContent>

            <div>
              <Button variant="outline" size="sm" className="w-full">
                Instructions
              </Button>
            </div>
          </TargetProviderCard>
          <TargetProviderCard>
            <TargetProviderContent>
              <TargetProviderHeading>
                <SiTerraform className="mx-auto text-4xl text-purple-400" />
                <div className="font-semibold">Terraform Cloud</div>
              </TargetProviderHeading>
              <p className="text-xs text-muted-foreground">
                Target provider terraform cloud workspaces.
              </p>
              <TargetProviderBadges>
                <Badge>TerraformWorkspace</Badge>
              </TargetProviderBadges>
            </TargetProviderContent>

            <div>
              <Button variant="outline" size="sm" className="w-full">
                Instructions
              </Button>
            </div>
          </TargetProviderCard>
          <TargetProviderCard>
            <TargetProviderContent>
              <TargetProviderHeading>
                <SiKubernetes className="mx-auto text-4xl text-blue-400" />
                <div className="font-semibold">Kubernetes Agent</div>
              </TargetProviderHeading>
              <p className="text-xs text-muted-foreground">
                Agent running on a cluster that can be used for scanning in
                namespaces.
              </p>
              <TargetProviderBadges>
                <Badge>KubernetesAPI</Badge>
                <Badge>KubernetesNamespace</Badge>
              </TargetProviderBadges>
            </TargetProviderContent>

            <div>
              <Button variant="outline" size="sm" className="w-full">
                Instructions
              </Button>
            </div>
          </TargetProviderCard>
        </div>
      </div>
    </div>
  );
};

export default function TargetProviderIntegrationsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  return <TargetProviders workspaceSlug={params.workspaceSlug} />;
}
