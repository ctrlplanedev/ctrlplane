import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const octokit =
  process.env.GITHUB_BOT_APP_ID == null
    ? null
    : new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: process.env.GITHUB_BOT_APP_ID,
          privateKey: process.env.GITHUB_BOT_PRIVATE_KEY,
          clientId: process.env.GITHUB_BOT_CLIENT_ID,
          clientSecret: process.env.GITHUB_BOT_CLIENT_SECRET,
        },
      });

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

const getOctokit = () => {
  if (octokit == null) throw new Error("GitHub bot not configured");
  return octokit;
};

const getInstallationId = async (
  workspaceId: string,
  jobAgentId: string,
): Promise<number> => {
  const client = getClientFor(workspaceId);
  const jobAgentResponse = await client.GET(
    "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
    { params: { path: { workspaceId, jobAgentId } } },
  );

  if (jobAgentResponse.response.status !== 200)
    throw new Error("Failed to get job agent");
  const jobAgent = jobAgentResponse.data;
  if (jobAgent?.type !== "github-app")
    throw new Error("Job agent is not a GitHub app");

  const config = jobAgent.config;
  if (config.type !== "github-app")
    throw new Error("Job agent is not a GitHub app");
  const { installationId } = config;

  const { data: installation } = await getOctokit().apps.getInstallation({
    installation_id: Number(installationId),
  });
  return installation.id;
};

const getGithubEntity = async (workspaceId: string, installationId: number) => {
  const client = getClientFor(workspaceId);
  const githubEntityResponse = await client.GET(
    "/v1/workspaces/{workspaceId}/github-entities/{installationId}",
    { params: { path: { workspaceId, installationId } } },
  );
  if (githubEntityResponse.response.status !== 200)
    throw new Error("Failed to get GitHub entity");
  return githubEntityResponse.data!;
};

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
) => {
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
) => {
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

const getReposForInstallation = async (
  githubEntity: WorkspaceEngine["schemas"]["GithubEntity"],
) => {
  const authedGhClient = getOctokitInstallation(githubEntity.installationId);
  const installationToken = (await authedGhClient.auth({
    type: "installation",
    installationId: githubEntity.installationId,
  })) as { token: string };

  return getRepos(1, [], authedGhClient, installationToken, githubEntity.slug);
};

export const githubRouter = router({
  reposForAgent: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        jobAgentId: z.string(),
      }),
    )
    .query(async ({ input: { workspaceId, jobAgentId } }) => {
      const installationId = await getInstallationId(workspaceId, jobAgentId);
      const githubEntity = await getGithubEntity(workspaceId, installationId);
      return getReposForInstallation(githubEntity);
    }),
});
