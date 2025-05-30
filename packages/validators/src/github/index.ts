import { z } from "zod";

export const configSchema = z.object({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  workflowId: z.number(),
  ref: z.string().optional().nullable(),
});

export enum GithubEvent {
  WorkflowRun = "workflow_run",
  PullRequest = "pull_request",
}

export enum PullRequestState {
  Open = "open",
  Closed = "closed",
  Draft = "draft",
  Merged = "merged",
}

export const getPullRequestState = (state: string): PullRequestState => {
  if (state === "open") return PullRequestState.Open;
  if (state === "closed") return PullRequestState.Closed;
  if (state === "draft") return PullRequestState.Draft;
  if (state === "merged") return PullRequestState.Merged;
  throw new Error(`Invalid pull request state: ${state}`);
};

export enum GitType {
  PullRequest = "pull-request",
}

export const GithubPullRequestVersion = "ctrlplane.dev/git/pull-request/v1";
export const GithubPullRequestKind = "GitHubPullRequest";

export const GithubUrlLinkMetadataKey = "Github Pull Request";

export enum PullRequestMetadataKey {
  ExternalId = "ctrlplane/external-id",
  GitType = "git/type",
  GitOwner = "git/owner",
  GitRepo = "git/repo",
  GitNumber = "git/number",
  GitTitle = "git/title",
  GitState = "git/state",
  GitStatus = "git/status",
  GitAuthor = "git/author",
  GitBranch = "git/branch",
  GitSourceBranch = "git/source-branch",
  GitTargetBranch = "git/target-branch",
  GitDraft = "git/draft",
  GitCreatedAt = "git/created-at",
  GitUpdatedAt = "git/updated-at",
  GitMergedAt = "git/merged-at",
  GitMergedBy = "git/merged-by",
  GitClosedAt = "git/closed-at",
  GitAdditions = "git/additions",
  GitDeletions = "git/deletions",
  GitChangedFiles = "git/changed-files",
  GitLabels = "git/labels",
  GitCommitCount = "git/commit-count",
}

export enum PullRequestCommitConfigKey {
  SHA = "sha",
  Message = "message",
  Author = "author",
  AuthorEmail = "author-email",
  URL = "url",
  Date = "date",
}

export enum PullRequestConfigKey {
  Number = "number",
  URL = "url",
  State = "state",
  CreatedAt = "createdAt",
  UpdatedAt = "updatedAt",
  Branch = "branch",
  IsDraft = "isDraft",
  Repository = "repository",
  Owner = "owner",
  Name = "name",
  Author = "author",
  Login = "login",
  AvatarUrl = "avatarUrl",
  Source = "source",
  Target = "target",
  OldestCommit = "oldestCommit",
  NewestCommit = "newestCommit",
  CommitCount = "commitCount",
}
