import type { Metadata } from "next";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { CreateApiKey, ListApiKeys } from "./ApiSection";

export const metadata: Metadata = { title: "API Key Creation" };

export default async function AccountSettingApiPage() {
  const apiKeys = await api.user.apiKey.list();
  return (
    <div>
      <PageHeader>
        <SidebarTrigger name={Sidebars.Workspace}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>API</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-40px)] overflow-auto">
        <div className="container mx-auto max-w-2xl space-y-8 py-8">
          <div className="space-y-6">
            <div>General</div>
            <div className="text-sm text-muted-foreground">
              You can create personal API keys for accessing Ctrlplane's API to
              build your own integration or hacks.
            </div>

            <ListApiKeys apiKeys={apiKeys} />
            <CreateApiKey />
          </div>
        </div>
      </div>
    </div>
  );
}
