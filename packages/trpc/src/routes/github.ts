import type { RestEndpointMethodTypes } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

const getOctokitInstallation = (installationId: number) =>
  new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_BOT_APP_ID,
      privateKey: process.env.GITHUB_BOT_PRIVATE_KEY,
      clientId: process.env.GITHUB_BOT_CLIENT_ID,
      clientSecret: process.env.GITHUB_BOT_CLIENT_SECRET,
      installationId,
    },
  });

type InstallationOctokitClient = ReturnType<typeof getOctokitInstallation>;

const githubAppConfig = z.object({
  type: z.literal("github-app"),
  installationId: z.number(),
  owner: z.string(),
});

type Workflow =
  RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"][number];

type Repo =
  RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][number] & {
    workflows: Workflow[];
  };

const getWorkflows = async (
  page: number,
  fetchedWorkflows: Workflow[],
  repo: RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][number],
  authedGhClient: InstallationOctokitClient,
  installationToken: { token: string },
): Promise<Workflow[]> => {
  const { data } = await authedGhClient.actions.listRepoWorkflows({
    repo: repo.name,
    owner: repo.owner.login,
    page,
    per_page: 100,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
      authorization: `Bearer ${installationToken.token}`,
    },
  });
  const workflows = [...data.workflows, ...fetchedWorkflows];
  if (data.workflows.length < 100) return workflows;
  return getWorkflows(
    page + 1,
    workflows,
    repo,
    authedGhClient,
    installationToken,
  );
};

const getRepos = async (
  page: number,
  fetchedRepos: Repo[],
  authedGhClient: InstallationOctokitClient,
  installationToken: { token: string },
  slug: string,
): Promise<Repo[]> => {
  const { data } = await authedGhClient.repos.listForOrg({
    org: slug,
    per_page: 100,
    page,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
      authorization: `Bearer ${installationToken.token}`,
    },
  });

  const reposWithWorkflows = await Promise.all(
    data.map(async (repo) => {
      const workflows = await getWorkflows(
        1,
        [],
        repo,
        authedGhClient,
        installationToken,
      );
      return { ...repo, workflows };
    }),
  );

  const repos = [...reposWithWorkflows, ...fetchedRepos];
  if (reposWithWorkflows.length < 100) return repos;
  return getRepos(page + 1, repos, authedGhClient, installationToken, slug);
};

export const githubRouter = router({
  reposForAgent: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        jobAgentId: z.string(),
      }),
    )
    .query(async ({ input: { workspaceId, jobAgentId }, ctx }) => {
      const jobAgent = await ctx.db.query.jobAgent.findFirst({
        where: and(
          eq(schema.jobAgent.id, jobAgentId),
          eq(schema.jobAgent.workspaceId, workspaceId),
        ),
      });

      if (jobAgent == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job agent not found",
        });

      const parsed = githubAppConfig.safeParse(jobAgent.config);
      if (!parsed.success)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job agent is not a GitHub app",
        });

      const { installationId, owner } = parsed.data;

      const authedGhClient = getOctokitInstallation(installationId);
      const installationToken = (await authedGhClient.auth({
        type: "installation",
        installationId,
      })) as { token: string };

      return getRepos(1, [], authedGhClient, installationToken, owner);
    }),
});
