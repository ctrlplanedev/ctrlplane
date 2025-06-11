import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { PullRequestEvent } from "@octokit/webhooks-types";

import { and, eq, takeFirstOrNull, upsertResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { dispatchUpdatedResourceJob } from "@ctrlplane/events";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import {
  getPullRequestState,
  GithubPullRequestKind,
  GithubPullRequestVersion,
  GithubUrlLinkMetadataKey,
  GitType,
  PullRequestCommitConfigKey,
  PullRequestConfigKey,
  PullRequestMetadataKey,
} from "@ctrlplane/validators/github";

import { getOctokitInstallation } from "../../octokit";

const getResourceProvider = async (
  installationId: number,
  repoId: number,
  slug: string,
) =>
  db
    .select()
    .from(schema.resourceProvider)
    .innerJoin(
      schema.resourceProviderGithubRepo,
      eq(
        schema.resourceProviderGithubRepo.resourceProviderId,
        schema.resourceProvider.id,
      ),
    )
    .innerJoin(
      schema.githubEntity,
      eq(
        schema.resourceProviderGithubRepo.githubEntityId,
        schema.githubEntity.id,
      ),
    )
    .where(
      and(
        eq(schema.githubEntity.installationId, installationId),
        eq(schema.githubEntity.slug, slug),
        eq(schema.resourceProviderGithubRepo.repoId, repoId),
      ),
    )
    .then(takeFirstOrNull);

const getDateMetadataValue = (date: string | null) => {
  if (date == null) return null;
  const dateObj = new Date(date);
  const dateTime = dateObj.getTime();
  if (Number.isNaN(dateTime) || dateTime === 0) return null;
  return dateObj.toISOString();
};

const getPullRequestMetadata = (
  organization: NonNullable<PullRequestEvent["organization"]>,
  repository: PullRequestEvent["repository"],
  pullRequest: PullRequestEvent["pull_request"],
): Record<string, string> => {
  const normalizedState = getPullRequestState(pullRequest.state);

  const createdAt = getDateMetadataValue(pullRequest.created_at);
  const updatedAt = getDateMetadataValue(pullRequest.updated_at);
  const mergedAt = getDateMetadataValue(pullRequest.merged_at);
  const closedAt = getDateMetadataValue(pullRequest.closed_at);

  const mergedBy = pullRequest.merged_by?.login ?? null;

  const labels = pullRequest.labels.map((label) => label.name).join(",");

  const links = JSON.stringify({
    [GithubUrlLinkMetadataKey]: pullRequest.html_url,
  });

  return {
    [PullRequestMetadataKey.ExternalId]: pullRequest.node_id,
    [PullRequestMetadataKey.GitType]: GitType.PullRequest,
    [PullRequestMetadataKey.GitOwner]: organization.login,
    [PullRequestMetadataKey.GitRepo]: repository.name,
    [PullRequestMetadataKey.GitNumber]: pullRequest.number.toString(),
    [PullRequestMetadataKey.GitTitle]: pullRequest.title,
    [PullRequestMetadataKey.GitState]: pullRequest.state,
    [PullRequestMetadataKey.GitStatus]: normalizedState,
    [PullRequestMetadataKey.GitAuthor]: pullRequest.user.login,
    [PullRequestMetadataKey.GitBranch]: pullRequest.head.ref,
    [PullRequestMetadataKey.GitSourceBranch]: pullRequest.head.ref,
    [PullRequestMetadataKey.GitTargetBranch]: pullRequest.base.ref,
    [PullRequestMetadataKey.GitDraft]: pullRequest.draft.toString(),
    ...(createdAt != null
      ? { [PullRequestMetadataKey.GitCreatedAt]: createdAt }
      : {}),
    ...(updatedAt != null
      ? { [PullRequestMetadataKey.GitUpdatedAt]: updatedAt }
      : {}),
    ...(mergedAt != null
      ? { [PullRequestMetadataKey.GitMergedAt]: mergedAt }
      : {}),
    ...(closedAt != null
      ? { [PullRequestMetadataKey.GitClosedAt]: closedAt }
      : {}),
    ...(mergedBy != null
      ? { [PullRequestMetadataKey.GitMergedBy]: mergedBy }
      : {}),
    [PullRequestMetadataKey.GitAdditions]: pullRequest.additions.toString(),
    [PullRequestMetadataKey.GitDeletions]: pullRequest.deletions.toString(),
    [PullRequestMetadataKey.GitChangedFiles]:
      pullRequest.changed_files.toString(),
    [PullRequestMetadataKey.GitLabels]: labels,
    [PullRequestMetadataKey.GitCommitCount]: pullRequest.commits.toString(),
    [ReservedMetadataKey.Links]: links,
  };
};

type Commit =
  RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"][number];

const fetchAllPullRequestCommits = async (
  installation: NonNullable<PullRequestEvent["installation"]>,
  repository: PullRequestEvent["repository"],
  pullRequest: PullRequestEvent["pull_request"],
) => {
  const { number } = pullRequest;
  const { owner, name } = repository;

  const authedClient = getOctokitInstallation(installation.id);
  if (authedClient == null)
    throw new Error("Failed to get authenticated Github client");

  let page = 1;

  let commits: Commit[] = [];

  while (true) {
    const pageCommits = await authedClient.pulls.listCommits({
      owner: owner.login,
      repo: name,
      pull_number: number,
      per_page: 100,
      page,
    });

    commits = [...commits, ...pageCommits.data];
    if (pageCommits.data.length < 100) break;
    page++;
  }

  return commits;
};

const getCleanedCommitMessage = (message: string) =>
  message.replace(/\n/g, " ").trim();

const getCommitInfo = (commit: Commit) => ({
  [PullRequestCommitConfigKey.SHA]: commit.sha,
  [PullRequestCommitConfigKey.Message]: getCleanedCommitMessage(
    commit.commit.message,
  ),
  [PullRequestCommitConfigKey.Author]: commit.commit.author?.name ?? null,
  [PullRequestCommitConfigKey.AuthorEmail]: commit.commit.author?.email ?? null,
  [PullRequestCommitConfigKey.URL]: commit.html_url,
  [PullRequestCommitConfigKey.Date]: getDateMetadataValue(
    commit.commit.author?.date ?? null,
  ),
});

const getPullRequestConfig = async (
  installation: NonNullable<PullRequestEvent["installation"]>,
  organization: NonNullable<PullRequestEvent["organization"]>,
  repository: PullRequestEvent["repository"],
  pullRequest: PullRequestEvent["pull_request"],
): Promise<Record<string, any>> => {
  const commits = await fetchAllPullRequestCommits(
    installation,
    repository,
    pullRequest,
  );

  const oldestCommit = commits.at(0);
  const newestCommit = commits.at(-1);

  const oldestCommitInfo =
    oldestCommit != null ? getCommitInfo(oldestCommit) : null;
  const newestCommitInfo =
    newestCommit != null ? getCommitInfo(newestCommit) : null;

  const baseBranchInfo = {
    [PullRequestConfigKey.Source]: pullRequest.head.ref,
    [PullRequestConfigKey.Target]: pullRequest.base.ref,
  };

  const branchInfo = {
    ...baseBranchInfo,
    ...(oldestCommitInfo != null
      ? { [PullRequestConfigKey.OldestCommit]: oldestCommitInfo }
      : {}),
    ...(newestCommitInfo != null
      ? { [PullRequestConfigKey.NewestCommit]: newestCommitInfo }
      : {}),
    [PullRequestConfigKey.CommitCount]: pullRequest.commits,
  };

  const createdAt = getDateMetadataValue(pullRequest.created_at);
  const updatedAt = getDateMetadataValue(pullRequest.updated_at);

  return {
    [PullRequestConfigKey.Number]: pullRequest.number.toString(),
    [PullRequestConfigKey.URL]: pullRequest.html_url,
    [PullRequestConfigKey.State]: pullRequest.state,
    ...(createdAt != null
      ? { [PullRequestConfigKey.CreatedAt]: createdAt }
      : {}),
    ...(updatedAt != null
      ? { [PullRequestConfigKey.UpdatedAt]: updatedAt }
      : {}),
    [PullRequestConfigKey.IsDraft]: pullRequest.draft,
    [PullRequestConfigKey.Repository]: {
      [PullRequestConfigKey.Owner]: organization.login,
      [PullRequestConfigKey.Name]: repository.name,
    },
    [PullRequestConfigKey.Author]: {
      [PullRequestConfigKey.Login]: pullRequest.user.login,
      [PullRequestConfigKey.AvatarUrl]: pullRequest.user.avatar_url,
    },
    [PullRequestConfigKey.Branch]: branchInfo,
  };
};

const createPullRequestResource = async (
  providerId: string,
  workspaceId: string,
  installation: NonNullable<PullRequestEvent["installation"]>,
  organization: NonNullable<PullRequestEvent["organization"]>,
  repository: PullRequestEvent["repository"],
  pullRequest: PullRequestEvent["pull_request"],
): Promise<schema.ResourceToUpsert> => {
  const metadata = getPullRequestMetadata(
    organization,
    repository,
    pullRequest,
  );

  const config = await getPullRequestConfig(
    installation,
    organization,
    repository,
    pullRequest,
  );

  const name = `${organization.login}-${repository.name}-${pullRequest.number}`;
  const identifier = `github-${pullRequest.node_id}`;

  return {
    name,
    identifier,
    version: GithubPullRequestVersion,
    kind: GithubPullRequestKind,
    config,
    metadata,
    workspaceId,
    providerId,
  };
};

export const handlePullRequestWebhookEvent = async (
  event: PullRequestEvent,
) => {
  const { pull_request, installation, organization, repository } = event;

  if (installation == null || organization == null) return;

  const resourceProviderResult = await getResourceProvider(
    installation.id,
    repository.id,
    organization.login,
  );

  if (resourceProviderResult == null) return;
  const { resource_provider: resourceProvider, github_entity: githubEntity } =
    resourceProviderResult;

  const resource = await createPullRequestResource(
    resourceProvider.id,
    githubEntity.workspaceId,
    installation,
    organization,
    repository,
    pull_request,
  );

  const resources = await db.transaction(async (tx) =>
    upsertResources(tx, githubEntity.workspaceId, [resource]),
  );

  await dispatchUpdatedResourceJob(resources);
};
