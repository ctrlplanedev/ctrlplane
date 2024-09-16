import type { PushEvent } from "@octokit/webhooks-types";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { githubConfigFile, githubOrganization } from "@ctrlplane/db/schema";

import { getOctokitInstallation } from "../../octokit";
import {
  getParsedConfig,
  handleModifiedConfigs,
  handleNewConfigs,
} from "./handle-configs";

const isConfigFile = (path: string) =>
  path.endsWith("ctrlplane.yaml") || path.endsWith("ctrlplane.yml");

export const handleCommitWebhookEvent = async (event: PushEvent) => {
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
