import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { NOT_FOUND } from "http-status";

import { env } from "~/env";
import { api } from "~/trpc/server";

export const GET = async (
  req: NextRequest,
  { params }: { params: { userId: string; workspaceSlug: string } },
) => {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const { userId, workspaceSlug } = params;

  const baseUrl = env.BASE_URL;
  const githubUrl = env.GITHUB_URL;

  const tokenResponse = await fetch(`${githubUrl}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_BOT_CLIENT_ID,
      client_secret: env.GITHUB_BOT_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenResponse.ok) throw new Error("Failed to fetch access token");
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  if (!accessToken)
    return NextResponse.json(
      { error: "Access token not found" },
      { status: NOT_FOUND },
    );

  const octokit = new Octokit({
    auth: accessToken,
  });

  const resp = await octokit.users.getAuthenticated();
  const { id: githubUserId } = resp.data;

  await api.github.user.create({
    userId: userId,
    githubUserId,
    githubUsername: resp.data.login,
  });

  return NextResponse.redirect(
    `${baseUrl}/${workspaceSlug}/settings/workspace/integrations/github`,
  );
};
