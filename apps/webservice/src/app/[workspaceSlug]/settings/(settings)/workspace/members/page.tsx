import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/server";
import { MembersTable } from "./WorkspaceMembersTable";

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

  const members = await api.workspace.members.list(workspace.id);
  const sessionMember = members.find((m) => m.user.id === session.user.id);

  return (
    <div className="container mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Manage who can access your workspace
        </p>
      </div>
      <div className="border-b" />
      <div className="space-y-1">
        <p className="font-semibold">Manage members</p>
      </div>
      <MembersTable
        data={members}
        workspace={workspace}
        sessionMember={sessionMember}
      />
      <div className="border-b" />
      <div className="flex items-center">
        <div className="flex-grow">
          <p>Export members list</p>
          <p className="text-sm text-muted-foreground">
            Export a CSV with information of all members in your workspace.
          </p>
        </div>
        <Button variant="secondary">Export CSV</Button>
      </div>
    </div>
  );
}
