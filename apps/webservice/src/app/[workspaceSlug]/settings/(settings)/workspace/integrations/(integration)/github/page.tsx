"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SiGithub } from "react-icons/si";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";

import { env } from "~/env";
import { api } from "~/trpc/react";
import { GithubConfigFileSync } from "./GithubConfigFile";
import { GithubOrgConfig } from "./GithubOrgConfig";

const githubAuthUrl = (userId?: string, workspaceSlug?: string) =>
  `${env.GITHUB_URL}/login/oauth/authorize?response_type=code&client_id=${env.NEXT_PUBLIC_GITHUB_BOT_CLIENT_ID}&redirect_uri=${env.BASE_URL}/api/github/${userId}/${workspaceSlug}&state=sLtHqpxQ6FiUtBWJ&scope=repo%2Cread%3Auser`;

export default function GitHubIntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const session = useSession();
  const router = useRouter();

  const githubUser = api.github.user.byUserId.useQuery(session.data!.user.id, {
    enabled: session.status === "authenticated",
  });

  const configFiles = api.github.configFile.list.useQuery(
    workspace.data?.id ?? "",
    {
      enabled: workspace.data != null,
    },
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
              router.push(githubAuthUrl(session.data!.user.id, workspaceSlug))
            }
          >
            Connect
          </Button>
        )}
        {githubUser.data != null && (
          <Button variant="secondary">Disconnect</Button>
        )}
      </Card>

      <GithubOrgConfig
        githubUser={githubUser.data}
        workspaceId={workspace.data?.id}
        workspaceSlug={workspaceSlug}
        loading={workspace.isLoading || githubUser.isLoading}
      />

      <GithubConfigFileSync configFiles={configFiles.data ?? []} />
    </div>
  );
}
