import type { Tx } from "@ctrlplane/db";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import {
  workspace,
  workspaceInviteLink,
  workspaceMember,
} from "@ctrlplane/db/schema";

export const getRedirectUrlFromWorkspaceInviteToken = (
  db: Tx,
  token: string,
  baseUrl: string,
) =>
  db.transaction(async (db) =>
    db
      .select()
      .from(workspaceInviteLink)
      .innerJoin(
        workspaceMember,
        eq(workspaceInviteLink.workspaceMemberId, workspaceMember.id),
      )
      .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
      .where(eq(workspaceInviteLink.token, token))
      .then(takeFirstOrNull)
      .then((ws) =>
        ws == null
          ? baseUrl
          : `${baseUrl}/api/workflow-invite-redirect/${ws.workspace.slug}`,
      ),
  );
