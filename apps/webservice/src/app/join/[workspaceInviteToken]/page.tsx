"use client";

import { notFound, useRouter } from "next/navigation";
import { v3 } from "murmurhash";
import { useSession } from "next-auth/react";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { Avatar, AvatarFallback } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

const getColorForAvatar = (name: string) => {
  const hash = v3(name);
  const { values, keys } = Object;

  const color = values(colors)[hash % keys(colors).length];
  return color[800];
};

export default function JoinPage({
  params,
}: {
  params: { workspaceInviteToken: string };
}) {
  const { workspaceInviteToken } = params;
  const session = useSession();
  const router = useRouter();
  const workspace =
    api.invite.workspace.fromInviteToken.useQuery(workspaceInviteToken);

  const workspaceMemberCreate =
    api.workspace.members.createFromInviteToken.useMutation();

  const handleJoinWorkspace = () => {
    workspaceMemberCreate
      .mutateAsync({
        workspaceId: workspace.data?.id ?? "",
        userId: session.data?.user.id ?? "",
      })
      .then(() => router.push(`/${workspace.data?.slug}`))
      .catch((e) => {
        const message = String(e.message);
        const isDuplicateKeyError = message.includes("duplicate key value");
        if (!isDuplicateKeyError || workspace.data == null) throw e;
        router.push(`/${workspace.data.slug}`);
      });
  };

  if (workspace.isSuccess && workspace.data == null) return notFound();

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card
        className={cn(
          "flex flex-col items-center space-y-6 rounded-md border-0 bg-neutral-900 p-8",
          "transition-opacity duration-500 ease-out",
          workspace.data != null ? "opacity-100" : "opacity-0",
        )}
      >
        <Avatar className="h-14 w-14">
          <AvatarFallback
            style={{
              backgroundColor: getColorForAvatar(workspace.data?.name ?? ""),
            }}
          >
            {workspace.data?.name.substring(0, 2).toUpperCase() ?? ""}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col items-center">
          <p className="mb-3 text-2xl text-neutral-100">
            Join {workspace.data?.name}
          </p>

          <p className="mb-5 text-sm text-muted-foreground">
            You have been invited to join the {workspace.data?.name} workspace.
          </p>
          <Button
            className="w-full"
            onClick={
              session.data?.user != null
                ? handleJoinWorkspace
                : () =>
                    router.push(
                      `/login/workspace-invite/${workspaceInviteToken}`,
                    )
            }
          >
            {session.data?.user != null ? "Join Workspace" : "Log in"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
