import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@ctrlplane/auth";

import { api } from "~/trpc/server";
import { MembersExport } from "./MembersExport";
import { MembersTable } from "./MembersTable";
import { WorkspaceDomainMatching } from "./WorkspaceDomainMatching";

export const metadata: Metadata = { title: "Workspace Members" };

export default async function WorkspaceSettingMembersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
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
    <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 container mx-auto h-[calc(100vh-40px)] max-w-2xl space-y-8 overflow-auto">
      <div className="container mx-auto max-w-2xl space-y-8">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage who can access your workspace
          </p>
        </div>
        <div className="border-b" />
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
  );
}
