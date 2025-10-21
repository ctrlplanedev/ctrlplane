import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { v3 } from "murmurhash";
import colors from "tailwindcss/colors";

import { auth } from "@ctrlplane/auth";
import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { workspace, workspaceInviteToken } from "@ctrlplane/db/schema";
import { cn } from "@ctrlplane/ui";
import { Avatar, AvatarFallback } from "@ctrlplane/ui/avatar";
import { Card } from "@ctrlplane/ui/card";

import { JoinWorkspaceButton } from "./JoinWorkspaceButton";

const getColorForAvatar = (name: string) => {
  const hash = v3(name);
  const { values, keys } = Object;

  const color = values(colors)[hash % keys(colors).length];
  return color[800];
};

export const metadata: Metadata = {
  title: "Accept Token Invite",
};

export default async function JoinPage(props: {
  params: Promise<{ workspaceInviteToken: string }>;
}) {
  const params = await props.params;
  const token = await db
    .select()
    .from(workspaceInviteToken)
    .innerJoin(workspace, eq(workspace.id, workspaceInviteToken.workspaceId))
    .where(eq(workspaceInviteToken.token, params.workspaceInviteToken))
    .then(takeFirstOrNull);

  if (token == null) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null)
    redirect(`/login?acceptToken=${params.workspaceInviteToken}`);

  const ws = token.workspace;

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card
        className={cn(
          "flex flex-col items-center space-y-6 rounded-md border-0 bg-neutral-900 p-8",
          "transition-opacity duration-500 ease-out",
        )}
      >
        <Avatar className="h-14 w-14">
          <AvatarFallback
            style={{ backgroundColor: getColorForAvatar(ws.name) }}
          >
            {ws.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col items-center">
          <p className="mb-3 text-2xl text-neutral-100">Join {ws.name}</p>

          <p className="mb-5 text-sm text-muted-foreground">
            You have been invited to join the {ws.name} workspace.
          </p>
          <JoinWorkspaceButton
            workspace={ws}
            token={params.workspaceInviteToken}
          />
        </div>
      </Card>
    </div>
  );
}
