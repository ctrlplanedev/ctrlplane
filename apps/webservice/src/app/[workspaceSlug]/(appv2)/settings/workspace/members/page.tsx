import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import { auth } from "@ctrlplane/auth";
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
import { MembersExport } from "./MembersExport";
import { MembersTable } from "./MembersTable";
import { WorkspaceDomainMatching } from "./WorkspaceDomainMatching";

export const metadata: Metadata = { title: "Workspace Members" };

export default async function WorkspaceSettingMembersPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const session = await auth();
  if (session == null) notFound();

  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const domainMatching = await api.workspace.emailDomainMatching.byWorkspaceId(
    workspace.id,
  );
  const members = await api.workspace.members.list(workspace.id);
  const roles = await api.workspace.roles(workspace.id);

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
              <BreadcrumbPage>Members</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 container mx-auto max-w-2xl space-y-8 overflow-auto pt-8">
        <div className="container mx-auto max-w-2xl space-y-8">
          <div className="space-y-1">
            <p className="font-semibold">Manage members ({members.length})</p>
          </div>
          <MembersTable data={members} workspace={workspace} />
          <div className="border-b" />
          <WorkspaceDomainMatching
            roles={roles}
            workspace={workspace}
            domainMatching={domainMatching}
          />
          <div className="border-b" />
          <MembersExport data={members} />
        </div>
      </div>
    </div>
  );
}
