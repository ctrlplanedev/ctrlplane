import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { PushEvent } from "@octokit/webhooks-types";
import * as yaml from "js-yaml";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { githubConfigFile, githubOrganization } from "@ctrlplane/db/schema";
import { configFile } from "@ctrlplane/validators";

import { env } from "~/env";
import { handleModifiedConfigs, handleNewConfigs } from "./handle-configs";

const getOctokitInstallation = (installationId: number) =>
  env.GITHUB_BOT_APP_ID == null ||
  env.GITHUB_BOT_PRIVATE_KEY == null ||
  env.GITHUB_BOT_CLIENT_ID == null ||
  env.GITHUB_BOT_CLIENT_SECRET == null
    ? null
    : new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: env.GITHUB_BOT_APP_ID,
          privateKey: env.GITHUB_BOT_PRIVATE_KEY,
          clientId: env.GITHUB_BOT_CLIENT_ID,
          clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
          installationId,
        },
      });

const isConfigFile = (path: string) =>
  path.endsWith("ctrlplane.yaml") || path.endsWith("ctrlplane.yml");

interface GetParsedConfigOptions {
  organization: string;
  repository: string;
  path: string;
  branch: string;
}

const getParsedConfig = (
  { organization, repository, path, branch }: GetParsedConfigOptions,
  installationOctokit: Octokit,
) =>
  installationOctokit.repos
    .getContent({
      owner: organization,
      repo: repository,
      path,
      ref: branch,
    })
    .then(({ data }) => {
      if (!("content" in data)) throw new Error("Invalid response data");
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const yamlContent = yaml.load(content);
      const parsed = configFile.safeParse(yamlContent);
      if (!parsed.success) throw new Error("Invalid config file");
      return {
        ...parsed.data,
        repositoryName: repository,
        path,
        branch,
      };
    });

const handleCommitWebhookEvent = async (event: PushEvent) => {
  const { ref, organization, repository, commits: eventCommits } = event;
  if (organization == null)
    throw new Error("Event not associated with an organization");

  const branch = ref.split("/").pop();

  const internalOrganization = await db
    .select()
    .from(githubOrganization)
    .where(eq(githubOrganization.organizationName, organization.login))
    .then(takeFirstOrNull);

  if (internalOrganization == null) throw new Error("Organization not found");

  if (internalOrganization.branch !== branch) return;

  const removedConfigFiles = eventCommits
    .flatMap((v) => v.removed)
    .filter(isConfigFile);

  if (removedConfigFiles.length > 0)
    await db
      .delete(githubConfigFile)
      .where(
        and(
          inArray(githubConfigFile.path, removedConfigFiles),
          eq(githubConfigFile.organizationId, internalOrganization.id),
        ),
      );

  const newConfigFiles = eventCommits
    .flatMap((v) => v.added)
    .filter(isConfigFile);
  const modifiedConfigFiles = eventCommits
    .flatMap((v) => v.modified)
    .filter(isConfigFile);

  const installationOctokit = getOctokitInstallation(
    internalOrganization.installationId,
  );

  if (installationOctokit == null) throw new Error("GitHub bot not configured");

  const [newParsedConfigs, modifiedParsedConfigs] = await Promise.all([
    Promise.allSettled(
      newConfigFiles.map(async (cf) => {
        return getParsedConfig(
          {
            organization: internalOrganization.organizationName,
            repository: repository.name,
            path: cf,
            branch: internalOrganization.branch,
          },
          installationOctokit,
        );
      }),
    ).then((results) =>
      results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter(isPresent),
    ),

    Promise.allSettled(
      modifiedConfigFiles.map(async (cf) => {
        return getParsedConfig(
          {
            organization: internalOrganization.organizationName,
            repository: repository.name,
            path: cf,
            branch: internalOrganization.branch,
          },
          installationOctokit,
        );
      }),
    ).then((results) =>
      results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter(isPresent),
    ),
  ]);

  await handleModifiedConfigs(
    modifiedParsedConfigs,
    internalOrganization,
    repository.name,
  );

  await handleNewConfigs(
    newParsedConfigs,
    internalOrganization,
    repository.name,
  );
};

export const POST = async (req: NextRequest) => {
  try {
    const event = req.headers.get("x-github-event")?.toString();
    const data = await req.json();

    if (event === "push") await handleCommitWebhookEvent(data as PushEvent);
    return new NextResponse("OK");
  } catch (e) {
    return new NextResponse((e as any).message, { status: 500 });
  }
};
