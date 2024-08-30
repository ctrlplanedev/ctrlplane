"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SiGithub } from "react-icons/si";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";
import { GithubConfigFileSync } from "./GithubConfigFile";
import { GithubOrgConfig } from "./GithubOrgConfig";

const githubAuthUrl = (
  baseUrl: string,
  githubUrl: string,
  clientId: string,
  userId?: string,
  workspaceSlug?: string,
) =>
  `${githubUrl}/login/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${baseUrl}/api/github/${userId}/${workspaceSlug}&state=sLtHqpxQ6FiUtBWJ&scope=repo%2Cread%3Auser`;

export default function GitHubIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const session = useSession();
  const router = useRouter();
  const baseUrl = api.runtime.baseUrl.useQuery();

  const githubUrl = api.runtime.github.url.useQuery();
  const githubBotName = api.runtime.github.bot.name.useQuery();
  const githubBotClientId = api.runtime.github.bot.clientId.useQuery();
  const isGithubConfigured =
    githubUrl.data != null &&
    githubBotName.data != null &&
    githubBotClientId.data != null;

  const githubUser = api.github.user.byUserId.useQuery(session.data!.user.id, {
    enabled: session.status === "authenticated",
  });

  const configFiles = api.github.configFile.list.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.data != null },
  );

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

      <Card className="flex items-center justify-between rounded-md p-4">
        <div className="flex flex-col">
          <p className="text-neutral-100">
            {githubUser.data != null
              ? "Personal account connected"
              : "Connect your personal account"}
          </p>
          <p className="text-sm text-muted-foreground">
            {githubUser.data != null
              ? "Your GitHub account is connected to Ctrlplane"
              : "Connect your GitHub account to Ctrlplane"}
          </p>
        </div>
        {githubUser.data == null && (
          <Button
            variant="secondary"
            onClick={() =>
              router.push(
                githubAuthUrl(
                  baseUrl.data ?? "",
                  githubUrl.data ?? "",
                  githubBotClientId.data ?? "",
                  session.data!.user.id,
                  workspaceSlug,
                ),
              )
            }
          >
            Connect
          </Button>
        )}
        {githubUser.data != null && (
          <Button variant="secondary">Disconnect</Button>
        )}
      </Card>

      {isGithubConfigured && (
        <GithubOrgConfig
          githubUser={githubUser.data}
          workspaceId={workspace.data?.id}
          workspaceSlug={workspaceSlug}
          loading={workspace.isLoading || githubUser.isLoading}
          githubConfig={{
            url: githubUrl.data ?? "",
            botName: githubBotName.data ?? "",
            clientId: githubBotClientId.data ?? "",
          }}
        />
      )}

      <GithubConfigFileSync configFiles={configFiles.data ?? []} />
    </div>
  );
}
