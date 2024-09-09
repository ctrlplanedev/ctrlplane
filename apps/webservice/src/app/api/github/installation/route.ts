import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import {
  BAD_REQUEST,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  UNAUTHORIZED,
} from "http-status";

import { auth } from "@ctrlplane/auth";
import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { user, workspace } from "@ctrlplane/db/schema";

import { env } from "~/env";
import { api } from "~/trpc/server";

const isValidGithubAppConfiguration =
  env.GITHUB_BOT_APP_ID != null &&
  env.GITHUB_BOT_PRIVATE_KEY != null &&
  env.GITHUB_BOT_CLIENT_ID != null &&
  env.GITHUB_BOT_CLIENT_SECRET != null;

const octokit = isValidGithubAppConfiguration
  ? new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: env.GITHUB_BOT_APP_ID,
        privateKey: env.GITHUB_BOT_PRIVATE_KEY,
        clientId: env.GITHUB_BOT_CLIENT_ID,
        clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
      },
    })
  : null;

const getOctokitInstallation = (installationId: number) =>
  isValidGithubAppConfiguration
    ? new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: env.GITHUB_BOT_APP_ID,
          privateKey: env.GITHUB_BOT_PRIVATE_KEY,
          clientId: env.GITHUB_BOT_CLIENT_ID,
          clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
          installationId,
        },
      })
    : null;

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

  const session = await auth();
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

  if (
    installation.data.target_type !== "Organization" ||
    installation.data.account == null
  ) {
    return NextResponse.json(
      { error: "Invalid installation type" },
      { status: BAD_REQUEST },
    );
  }

  const installationOctokit = getOctokitInstallation(installation.data.id);
  if (installationOctokit == null)
    return NextResponse.json(
      { error: "Failed to get authenticated Github client" },
      { status: INTERNAL_SERVER_ERROR },
    );

  const targetId = installation.data.target_id;
  const orgData = await installationOctokit.orgs.get({
    org: String(targetId),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  await api.github.organizations.create({
    workspaceId: activeWorkspace.id,
    installationId: installation.data.id,
    organizationName: orgData.data.login,
    avatarUrl: orgData.data.avatar_url,
    addedByUserId: u.id,
  });

  await api.job.agent.create({
    workspaceId: activeWorkspace.id,
    type: "github-app",
    name: orgData.data.login,
    config: {
      installationId: installation.data.id,
      owner: orgData.data.login,
    },
  });

  const baseUrl = env.BASE_URL;
  const workspaceSlug = activeWorkspace.slug;

  return NextResponse.redirect(
    `${baseUrl}/${workspaceSlug}/settings/workspace/integrations/github`,
  );
};
