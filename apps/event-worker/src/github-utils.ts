import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

import { JobExecutionStatus } from "@ctrlplane/db/schema";

import { env } from "./config";

export const configSchema = z.object({
  installationId: z.number(),
  login: z.string().min(1),
  repo: z.string().min(1),
  workflowId: z.number(),
});

export const convertStatus = (status: string): JobExecutionStatus => {
  if (status === "success" || status === "neutral") return "completed";
  if (status === "queued" || status === "requested" || status === "waiting")
    return "pending";
  if (status === "timed_out" || status === "stale") return "failure";
  return status as JobExecutionStatus;
};

export const getOctokit = () =>
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
        },
      })
    : null;
