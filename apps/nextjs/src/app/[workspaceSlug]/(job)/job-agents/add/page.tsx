"use client";

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { TbBolt, TbCheck, TbNumber1, TbNumber2 } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";

import { env } from "~/env";
import { api } from "~/trpc/react";
import { GithubJobAgentConfig } from "./GithubConfig";
import { JobAgentSelectCard } from "./JobAgentSelectCard";
import { KubernetesJobDeploy } from "./KubernetesConfig";

const githubAuthUrl = (userId?: string) =>
  `${env.GITHUB_URL}/login/oauth/authorize?response_type=code&client_id=${env.NEXT_PUBLIC_GITHUB_BOT_CLIENT_ID}&redirect_uri=${env.BASE_URL}/api/github/${userId}&state=sLtHqpxQ6FiUtBWJ&scope=repo%2Cread%3Auser`;

export default function AddJobAgentPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const [jobAgentType, setJobAgentType] = useState<string | null>(null);
  const session = useSession();

  const githubUser = api.github.user.byUserId.useQuery(
    session.data?.user.id ?? "",
    { enabled: session.status === "authenticated" },
  );

  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  useEffect(() => {
    const isGithubDisptacher = jobAgentType === "github-app";
    const isUserUnauthenticatedForGit =
      !githubUser.isLoading && githubUser.data == null;

    if (isGithubDisptacher && isUserUnauthenticatedForGit)
      redirect(githubAuthUrl(session.data?.user.id));
  }, [jobAgentType, githubUser, workspace, session]);

  return (
    <div className="container my-8 max-w-3xl space-y-4">
      <h1 className="mb-10 flex flex-grow items-center gap-3 text-2xl font-semibold">
        <TbBolt />
        Add Job Agent
      </h1>
      <div className="grid grid-cols-2 gap-2 px-4">
        <div
          onClick={() => setJobAgentType(null)}
          className={cn(
            "flex items-center gap-4",
            jobAgentType != null && "cursor-pointer text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border",
              jobAgentType == null && "border-blue-500",
            )}
          >
            {jobAgentType == null ||
            (jobAgentType === "github-app" && githubUser.data == null) ? (
              <TbNumber1 />
            ) : (
              <TbCheck />
            )}
          </div>
          <div>Select job agent</div>
        </div>

        <div
          className={cn(
            "flex items-center gap-4",
            jobAgentType == null && "text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border",
              jobAgentType != null && "border-blue-500",
            )}
          >
            <TbNumber2 />
          </div>
          <div>Configure job agent</div>
        </div>
      </div>
      {jobAgentType == null && (
        <JobAgentSelectCard setValue={setJobAgentType} />
      )}
      {jobAgentType === "kubernetes-job" && <KubernetesJobDeploy />}
      {jobAgentType === "github-app" &&
        githubUser.data != null &&
        workspace.data != null && (
          <GithubJobAgentConfig
            githubUser={githubUser.data}
            workspaceSlug={workspaceSlug}
            workspaceId={workspace.data.id}
          />
        )}
    </div>
  );
}
