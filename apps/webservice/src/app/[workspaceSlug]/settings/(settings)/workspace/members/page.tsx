"use client";

import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";
import { TbArrowRight } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { MembersTable } from "./WorkspaceMembersTable";

export default function WorkspaceSettingMembersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const session = useSession();
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const members = api.workspace.members.list.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );
  const sessionMember = members.data?.find(
    (m) => m.user.id === session.data?.user.id,
  );

  if (!workspace.isLoading && workspace.data == null) return notFound();

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
        <p className="text-sm text-muted-foreground">
          On the Free plan all members in a workspace are administrators.
          Upgrade to a paid plan to add the ability to assign or remove
          administrator roles.{" "}
          <span className="inline-flex items-center text-blue-600">
            Go to Plans <TbArrowRight />
          </span>
        </p>
      </div>
      <MembersTable
        data={members.data ?? []}
        workspaceSlug={workspaceSlug}
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
