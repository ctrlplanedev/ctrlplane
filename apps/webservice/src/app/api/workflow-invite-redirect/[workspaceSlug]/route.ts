import { NextResponse } from "next/server";

import { auth } from "@ctrlplane/auth";
import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { workspace, workspaceMember } from "@ctrlplane/db/schema";

import { api } from "~/trpc/server";

export const GET = async ({
  params,
}: {
  params: { workspaceSlug: string };
}) => {
  const { workspaceSlug } = params;
  const session = await auth();
  if (session?.user == null) return NextResponse.redirect("/login");

  const baseUrl = await api.runtime.baseUrl();

  await db
    .transaction((db) =>
      db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, workspaceSlug))
        .then(takeFirst)
        .then((ws) =>
          db.insert(workspaceMember).values({
            userId: session.user.id,
            workspaceId: ws.id,
          }),
        ),
    )
    .catch((e) => {
      const isDuplicateKeyError = String(e.message).includes(
        "duplicate key value",
      );
      if (isDuplicateKeyError)
        return NextResponse.redirect(`${baseUrl}/${workspaceSlug}`);

      throw e;
    });

  return NextResponse.redirect(`${baseUrl}/${workspaceSlug}`);
};
