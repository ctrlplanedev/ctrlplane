import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

import { JobStatus as JStatus } from "@ctrlplane/validators/jobs";

import { env } from "./config.js";

export const convertStatus = (status: string): JStatus => {
  if (status === "success" || status === "neutral") return JStatus.Completed;
  if (status === "queued" || status === "requested" || status === "waiting")
    return JStatus.InProgress;
  if (status === "timed_out" || status === "stale") return JStatus.Failure;
  return status as JStatus;
};

export const getInstallationOctokit = (installationId: number) =>
  env.GITHUB_BOT_APP_ID &&
  env.GITHUB_BOT_PRIVATE_KEY &&
  env.GITHUB_BOT_CLIENT_ID &&
  env.GITHUB_BOT_CLIENT_SECRET
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
