import type { RouterOutputs } from "@ctrlplane/api";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconMenu2, IconPlus, IconTag } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { api } from "~/trpc/server";
import { PageHeader } from "../../_components/PageHeader";
import { Sidebars } from "../../../sidebars";
import { VersionChannelTable } from "./_components/VersionChannelTable";

// Use the correct type from RouterOutputs
type BasePolicy = RouterOutputs["policy"]["list"][number];

// Define a type for policies confirmed to have the selector/channel rule
interface PolicyWithChannel extends BasePolicy {
  deploymentVersionSelector: NonNullable<
    BasePolicy["deploymentVersionSelector"]
  >;
}

// Type guard function
function hasVersionChannel(policy: BasePolicy): policy is PolicyWithChannel {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return policy.deploymentVersionSelector != null;
}

export default async function VersionChannelsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const policies = await api.policy.list(workspace.id);
  const policiesWithVersionChannels = policies.filter(hasVersionChannel);

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Policies}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/${workspaceSlug}/policies`}>Policies</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Version Channels</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex gap-2">
          {/* Removed Back Button for now, might add later */}
          <Button variant="outline" size="sm">
            <IconPlus className="mr-2 h-4 w-4" />
            Create Version Channel Rule
          </Button>
        </div>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Version Channels</h1>
          <p className="text-sm text-muted-foreground">
            Define rules to control which deployment versions are eligible for
            release.
          </p>
        </div>

        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTag className="h-5 w-5 text-indigo-400" />
                <span>What are Version Channels?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Version Channels allow you to group deployment versions based on
                criteria like tags or metadata. You can then create policies
                that restrict deployments to specific channels (e.g., only
                allowing "stable" channel releases into production). This helps
                maintain consistency and prevent unintended deployments.
              </p>
            </CardContent>
          </Card>
        </div>

        <VersionChannelTable policies={policiesWithVersionChannels} />
      </div>
    </div>
  );
}
