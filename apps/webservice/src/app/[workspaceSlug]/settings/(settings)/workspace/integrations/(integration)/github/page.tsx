import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiGithub } from "react-icons/si";

import { auth } from "@ctrlplane/auth";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { env } from "~/env";
import { api } from "~/trpc/server";
import { DeleteGithubUserButton } from "./DeleteGithubUserButton";
import { GithubConfigFileSync } from "./GithubConfigFile";
import { GithubConnectedOrgs } from "./GithubConnectedOrgs";

const githubAuthUrl = (
  baseUrl: string,
  githubUrl: string,
  clientId: string,
  userId?: string,
  workspaceSlug?: string,
) =>
  `${githubUrl}/login/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${baseUrl}/api/github/${userId}/${workspaceSlug}&state=sLtHqpxQ6FiUtBWJ&scope=repo%2Cread%3Auser`;

export default async function GitHubIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();
  const session = await auth();
  if (session == null) redirect("/login");

  const baseUrl = env.BASE_URL;

  const githubUrl = env.GITHUB_URL;
  const githubBotName = env.GITHUB_BOT_NAME;
  const githubBotClientId = env.GITHUB_BOT_CLIENT_ID;
  const isGithubConfigured =
    githubUrl != null && githubBotName != null && githubBotClientId != null;

  const githubUser = await api.github.user.byUserId(session.user.id);

  const configFiles = await api.github.configFile.list(workspace.id);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-4">
        <SiGithub className="h-14 w-14" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">GitHub</h1>
          <p className="text-sm text-muted-foreground">
            Connect a Github organization to Ctrlplane to configure job agents
            and sync config files.
          </p>
        </div>
      </div>

      <div className="flex w-[768px] flex-col gap-12">
        <Card className="flex items-center justify-between rounded-md p-4">
          <div className="flex flex-col">
            <p className="text-neutral-100">
              {githubUser != null
                ? "Personal account connected"
                : "Connect your personal account"}
            </p>
            <p className="w-[500px] text-wrap text-sm text-muted-foreground">
              {githubUser != null
                ? "Your GitHub account is connected to Ctrlplane"
                : "Connect your GitHub account to Ctrlplane to add Github organizations to your workspaces"}
            </p>
          </div>
          {githubUser == null && (
            <Link
              href={githubAuthUrl(
                baseUrl,
                githubUrl ?? "",
                githubBotClientId ?? "",
                session.user.id,
                workspaceSlug,
              )}
            >
              <Button variant="secondary">Connect</Button>
            </Link>
          )}
          {githubUser != null && (
            <DeleteGithubUserButton githubUserId={githubUser.userId} />
          )}
        </Card>

        {isGithubConfigured && (
          <GithubConnectedOrgs
            githubUser={githubUser}
            workspaceId={workspace.id}
            loading={false}
            githubConfig={{
              url: githubUrl,
              botName: githubBotName,
              clientId: githubBotClientId,
            }}
          />
        )}

        <GithubConfigFileSync configFiles={configFiles} />
      </div>
    </div>
  );
}
