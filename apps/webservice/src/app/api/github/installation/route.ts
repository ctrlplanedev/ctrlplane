import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  BAD_REQUEST,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  UNAUTHORIZED,
} from "http-status";

import { auth } from "@ctrlplane/auth";
import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { githubEntity, jobAgent, user, workspace } from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";

import type { AuthedOctokitClient } from "../octokit";
import { env } from "~/env";
import { getOctokitInstallation, octokit } from "../octokit";

const createOrganizationEntity = async (
  client: AuthedOctokitClient,
  installationId: number,
  installationTargetId: number,
  workspaceId: string,
  userId: string,
) => {
  const orgData = await client.orgs.get({
    org: String(installationTargetId),
    headers: { "X-GitHub-Api-Version": "2022-11-28" },
  });

  return db
    .insert(githubEntity)
    .values({
      installationId,
      type: "organization",
      slug: orgData.data.login,
      addedByUserId: userId,
      workspaceId,
      avatarUrl: orgData.data.avatar_url,
    })
    .returning()
    .then(takeFirst);
};

const createUserEntity = async (
  client: AuthedOctokitClient,
  installationId: number,
  installationTargetId: number,
  workspaceId: string,
  userId: string,
) => {
  const userData = (await client.request("GET /user/{account_id}", {
    account_id: installationTargetId,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })) as { data: { login: string; avatar_url: string } };

  return db
    .insert(githubEntity)
    .values({
      installationId,
      type: "user",
      slug: userData.data.login,
      addedByUserId: userId,
      workspaceId,
      avatarUrl: userData.data.avatar_url,
    })
    .returning()
    .then(takeFirst);
};

export const GET = async (req: NextRequest) => {
  if (octokit == null)
    return NextResponse.json(
      { error: "GitHub app not configured" },
      { status: INTERNAL_SERVER_ERROR },
    );

  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");

  if (installationId == null || setupAction == null)
    return NextResponse.json(
      { error: "Invalid request from GitHub" },
      { status: BAD_REQUEST },
    );

  if (setupAction !== "install")
    return NextResponse.json(
      { error: "Invalid setup action" },
      { status: BAD_REQUEST },
    );

  const session = await auth.api.getSession({ headers: req.headers });
  if (session == null)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: UNAUTHORIZED },
    );

  const u = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .then(takeFirstOrNull);
  if (u == null)
    return NextResponse.json(
      { error: "User not found" },
      { status: UNAUTHORIZED },
    );

  if (u.activeWorkspaceId == null)
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: NOT_FOUND },
    );

  const activeWorkspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, u.activeWorkspaceId))
    .then(takeFirstOrNull);

  if (activeWorkspace == null)
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: NOT_FOUND },
    );

  const installation = await octokit.apps.getInstallation({
    installation_id: Number(installationId),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (installation.data.account == null)
    return NextResponse.json(
      { error: "Installation account not found" },
      { status: BAD_REQUEST },
    );

  const authedClient = getOctokitInstallation(installation.data.id);
  if (authedClient == null)
    return NextResponse.json(
      { error: "Failed to get authenticated Github client" },
      { status: INTERNAL_SERVER_ERROR },
    );

  const createEntity =
    installation.data.target_type === "Organization"
      ? createOrganizationEntity
      : createUserEntity;

  const entity = await createEntity(
    authedClient,
    installation.data.id,
    installation.data.target_id,
    activeWorkspace.id,
    u.id,
  );

  const createdAgent = await db
    .insert(jobAgent)
    .values({
      workspaceId: activeWorkspace.id,
      name: entity.slug,
      type: "github-app",
      config: {
        installationId: entity.installationId,
        owner: entity.slug,
      },
    })
    .returning()
    .then(takeFirst);

  await eventDispatcher.dispatchJobAgentCreated(createdAgent);

  return NextResponse.redirect(
    `${env.BASE_URL}/${activeWorkspace.slug}/settings/workspace/integrations/github`,
  );
};
