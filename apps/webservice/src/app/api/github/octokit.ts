import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

import { env } from "~/env";

const isValidGithubAppConfiguration =
  env.GITHUB_BOT_APP_ID != null &&
  env.GITHUB_BOT_PRIVATE_KEY != null &&
  env.GITHUB_BOT_CLIENT_ID != null &&
  env.GITHUB_BOT_CLIENT_SECRET != null;

export const octokit = isValidGithubAppConfiguration
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

export const getOctokitInstallation = (installationId: number) =>
  isValidGithubAppConfiguration
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

export type AuthedOctokitClient = NonNullable<
  ReturnType<typeof getOctokitInstallation>
>;
