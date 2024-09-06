import type { Tx } from "@ctrlplane/db";
import type {
  GithubOrganization,
  GithubOrganizationInsert,
} from "@ctrlplane/db/schema";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import * as yaml from "js-yaml";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, takeFirst } from "@ctrlplane/db";
import {
  deployment,
  githubConfigFile,
  githubOrganization,
  system,
  workspace,
} from "@ctrlplane/db/schema";
import { configFile } from "@ctrlplane/validators";

import { env } from "../../config";

type ConfigFile =
  RestEndpointMethodTypes["search"]["code"]["response"]["data"]["items"][number];

type ParsedConfigFile = ConfigFile & {
  content: {
    deployments: {
      name: string;
      slug: string;
      system: string;
      workspace: string;
      description?: string | undefined;
    }[];
  };
};

const octokit =
  env.GITHUB_BOT_APP_ID == null
    ? null
    : new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: env.GITHUB_BOT_APP_ID,
          privateKey: env.GITHUB_BOT_PRIVATE_KEY,
          clientId: env.GITHUB_BOT_CLIENT_ID,
          clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
        },
      });

const getOctokitInstallation = (installationId: number) =>
  new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_BOT_APP_ID,
      privateKey: env.GITHUB_BOT_PRIVATE_KEY,
      clientId: env.GITHUB_BOT_CLIENT_ID,
      clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
      installationId,
    },
  });

const parseConfigFile = async (
  cf: ConfigFile,
  orgName: string,
  branch: string,
  installationOctokit: Octokit,
) => {
  const content = await installationOctokit.repos
    .getContent({
      owner: orgName,
      repo: cf.repository.name,
      path: cf.path,
      ref: branch,
    })
    .then(({ data }) => {
      if (!("content" in data)) throw new Error("Invalid response data");
      return Buffer.from(data.content, "base64").toString("utf-8");
    });

  const yamlContent = yaml.load(content);
  const parsed = configFile.safeParse(yamlContent);
  if (!parsed.success) throw new Error("Invalid config file");

  return {
    ...cf,
    content: parsed.data,
  };
};

const processParsedConfigFiles = async (
  db: Tx,
  parsedConfigFiles: ParsedConfigFile[],
  org: GithubOrganization,
) => {
  const deploymentInfo = await db
    .select()
    .from(system)
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(
      and(
        inArray(
          system.slug,
          parsedConfigFiles
            .map((d) => d.content.deployments.map((d) => d.system))
            .flat(),
        ),
        inArray(
          workspace.slug,
          parsedConfigFiles
            .map((d) => d.content.deployments.map((d) => d.workspace))
            .flat(),
        ),
      ),
    );

  const insertedConfigFiles = await db
    .insert(githubConfigFile)
    .values(
      parsedConfigFiles.map((d) => ({
        ...d,
        workspaceId: org.workspaceId,
        organizationId: org.id,
        repositoryName: d.repository.name,
      })),
    )
    .returning();

  const deployments = parsedConfigFiles
    .map((cf) =>
      cf.content.deployments.map((d) => {
        const info = deploymentInfo.find(
          (i) => i.system.slug === d.system && i.workspace.slug === d.workspace,
        );
        if (info == null) throw new Error("Deployment info not found");
        const { system, workspace } = info;

        return {
          ...d,
          systemId: system.id,
          workspaceId: workspace.id,
          description: d.description ?? "",
          githubConfigFileId: insertedConfigFiles.find(
            (icf) =>
              icf.path === cf.path && icf.repositoryName === cf.repository.name,
          )?.id,
        };
      }),
    )
    .flat();

  await db.insert(deployment).values(deployments);
};

export const createNewGithubOrganization = async (
  db: Tx,
  githubOrganizationConfig: GithubOrganizationInsert,
) =>
  db.transaction(async (db) => {
    const org = await db
      .insert(githubOrganization)
      .values(githubOrganizationConfig)
      .returning()
      .then(takeFirst);

    const installation = await octokit?.apps.getInstallation({
      installation_id: org.installationId,
    });
    if (installation == null) throw new Error("Failed to get installation");

    const installationOctokit = getOctokitInstallation(installation.data.id);
    const installationToken = (await installationOctokit.auth({
      type: "installation",
      installationId: installation.data.id,
    })) as { token: string };

    const configFiles = await Promise.all([
      installationOctokit.search.code({
        q: `org:${org.organizationName} filename:ctrlplane.yaml`,
        per_page: 100,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
          authorization: `Bearer ${installationToken.token}`,
        },
      }),
      installationOctokit.search.code({
        q: `org:${org.organizationName} filename:ctrlplane.yml`,
        per_page: 100,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
          authorization: `Bearer ${installationToken.token}`,
        },
      }),
    ]).then((responses) => {
      return [...responses[0].data.items, ...responses[1].data.items];
    });

    if (configFiles.length === 0) return;

    const parsedConfigFiles = await Promise.allSettled(
      configFiles.map((cf) =>
        parseConfigFile(
          cf,
          org.organizationName,
          org.branch,
          installationOctokit,
        ),
      ),
    ).then((results) =>
      results
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter(isPresent),
    );

    await processParsedConfigFiles(db, parsedConfigFiles, org);
  });
