import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import * as yaml from "js-yaml";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, inArray, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  deployment,
  githubConfigFile,
  githubOrganization,
  githubOrganizationInsert,
  githubUser,
  system,
  workspace,
} from "@ctrlplane/db/schema";
import { configFile } from "@ctrlplane/validators";

import { env } from "../config";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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

const getOctokit = () => {
  if (octokit == null)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "GitHub bot not configured",
    });
  return octokit;
};

const userRouter = createTRPCRouter({
  byUserId: protectedProcedure
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(githubUser)
        .where(eq(githubUser.userId, input))
        .then(takeFirstOrNull),
    ),

  create: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        githubUserId: z.number(),
        githubUsername: z.string(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(githubUser)
        .values(input)
        .returning()
        .then((data) => data[0]),
    ),
});

const reposRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ installationId: z.number(), login: z.string() }))
    .query(({ input }) =>
      octokit?.apps
        .getInstallation({
          installation_id: input.installationId,
        })
        .then(async ({ data: installation }) => {
          const installationOctokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
              appId: env.GITHUB_BOT_APP_ID,
              privateKey: env.GITHUB_BOT_PRIVATE_KEY,
              clientId: env.GITHUB_BOT_CLIENT_ID,
              clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
              installationId: installation.id,
            },
          });

          const installationToken = (await installationOctokit.auth({
            type: "installation",
            installationId: installation.id,
          })) as { token: string };

          const searchResponse = await installationOctokit.search.code({
            q: `org:${input.login} filename:example.ctrlplane.yaml`,
            per_page: 100,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
              authorization: `Bearer ${installationToken.token}`,
            },
          });

          return installationOctokit.repos
            .listForOrg({
              org: input.login,
              headers: {
                "X-GitHub-Api-Version": "2022-11-28",
                authorization: `Bearer ${installationToken.token}`,
              },
            })
            .then(({ data }) =>
              data.map((repo) => ({
                ...repo,
                configFiles: searchResponse.data.items.filter(
                  (item) => item.repository.full_name === repo.full_name,
                ),
              })),
            );
        }),
    ),

  workflows: createTRPCRouter({
    list: protectedProcedure
      .input(
        z.object({
          installationId: z.number(),
          login: z.string(),
          repo: z.string(),
        }),
      )
      .query(async ({ input }) => {
        const installationOctokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: env.GITHUB_BOT_APP_ID,
            privateKey: env.GITHUB_BOT_PRIVATE_KEY,
            clientId: env.GITHUB_BOT_CLIENT_ID,
            clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
            installationId: input.installationId,
          },
        });

        const installationToken = (await installationOctokit.auth({
          type: "installation",
          installationId: input.installationId,
        })) as { token: string };

        return installationOctokit.actions.listRepoWorkflows({
          owner: input.login,
          repo: input.repo,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
            authorization: `Bearer ${installationToken.token}`,
          },
        });
      }),
  }),
});

const configFileRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      access: ({ ctx, input }) => ctx.accessQuery().workspace.id(input),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(githubConfigFile)
        .where(eq(githubConfigFile.workspaceId, input)),
    ),
});

export const githubRouter = createTRPCRouter({
  user: userRouter,

  configFile: configFileRouter,

  organizations: createTRPCRouter({
    byGithubUserId: protectedProcedure.input(z.number()).query(({ input }) =>
      getOctokit()
        .apps.listInstallations({
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        })
        .then(({ data: installations }) =>
          Promise.all(
            installations
              .filter((i) => i.target_type === "Organization")
              .map(async (i) => {
                const installationOctokit = new Octokit({
                  authStrategy: createAppAuth,
                  auth: {
                    appId: env.GITHUB_BOT_APP_ID,
                    privateKey: env.GITHUB_BOT_PRIVATE_KEY,
                    clientId: env.GITHUB_BOT_CLIENT_ID,
                    clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
                    installationId: i.id,
                  },
                });

                const installationToken = (await installationOctokit.auth({
                  type: "installation",
                  installationId: i.id,
                })) as { token: string };

                const members = await installationOctokit.orgs.listMembers({
                  org: i.account?.login ?? "",
                  headers: {
                    "X-GitHub-Api-Version": "2022-11-28",
                    authorization: `Bearer ${installationToken.token}`,
                  },
                });

                const isUserInGithubOrg =
                  members.data.find((m) => m.id === input) != null;
                if (!isUserInGithubOrg) return null;

                return _.merge(
                  await installationOctokit.orgs.get({
                    org: i.account?.login ?? "",
                    headers: {
                      "X-GitHub-Api-Version": "2022-11-28",
                    },
                  }),
                  { installationId: i.id },
                );
              }),
          ).then((orgs) => orgs.filter(isPresent)),
        ),
    ),

    byWorkspaceId: protectedProcedure
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        const internalOrgs = await ctx.db
          .select()
          .from(githubOrganization)
          .where(eq(githubOrganization.workspaceId, input));

        return getOctokit()
          .apps.listInstallations({
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
          })
          .then(({ data: installations }) =>
            Promise.all(
              installations.filter(
                (i) =>
                  i.target_type === "Organization" &&
                  internalOrgs.find((org) => org.installationId === i.id) !=
                    null,
              ),
            ),
          );
      }),

    list: protectedProcedure
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .select()
          .from(githubOrganization)
          .leftJoin(
            githubUser,
            eq(githubOrganization.addedByUserId, githubUser.userId),
          )
          .where(eq(githubOrganization.workspaceId, input)),
      ),

    create: protectedProcedure
      .input(githubOrganizationInsert)
      .mutation(({ ctx, input }) =>
        ctx.db.transaction((db) =>
          db
            .insert(githubOrganization)
            .values(input)
            .returning()
            .then(takeFirst)
            .then((org) =>
              getOctokit()
                .apps.getInstallation({
                  installation_id: org.installationId,
                })
                .then(async ({ data: installation }) => {
                  const installationOctokit = new Octokit({
                    authStrategy: createAppAuth,
                    auth: {
                      appId: env.GITHUB_BOT_APP_ID,
                      privateKey: env.GITHUB_BOT_PRIVATE_KEY,
                      clientId: env.GITHUB_BOT_CLIENT_ID,
                      clientSecret: env.GITHUB_BOT_CLIENT_SECRET,
                      installationId: installation.id,
                    },
                  });

                  const installationToken = (await installationOctokit.auth({
                    type: "installation",
                    installationId: installation.id,
                  })) as { token: string };

                  const searchResponse = await installationOctokit.search.code({
                    q: `org:${org.organizationName} filename:example.ctrlplane.yaml`,
                    per_page: 100,
                    headers: {
                      "X-GitHub-Api-Version": "2022-11-28",
                      authorization: `Bearer ${installationToken.token}`,
                    },
                  });

                  const {
                    data: { items: configFiles },
                  } = searchResponse;

                  const parsedConfigFiles = await Promise.all(
                    configFiles.map(async (cf) => {
                      const content = await installationOctokit.repos
                        .getContent({
                          owner: org.organizationName,
                          repo: cf.repository.name,
                          path: cf.path,
                          ref: "main",
                        })
                        .then(({ data }) => {
                          if (!("content" in data))
                            throw new Error("Invalid response data");
                          return Buffer.from(data.content, "base64").toString(
                            "utf-8",
                          );
                        });

                      const yamlContent = yaml.load(content);
                      const parsed = configFile.safeParse(yamlContent);
                      if (!parsed.success)
                        throw new TRPCError({
                          code: "BAD_REQUEST",
                          message: "Invalid config file",
                        });

                      return {
                        ...cf,
                        content: parsed.data,
                      };
                    }),
                  );

                  const deploymentInfo = await db
                    .select()
                    .from(system)
                    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
                    .where(
                      and(
                        inArray(
                          system.slug,
                          parsedConfigFiles
                            .map((d) =>
                              d.content.deployments.map((d) => d.system),
                            )
                            .flat(),
                        ),
                        inArray(
                          workspace.slug,
                          parsedConfigFiles
                            .map((d) =>
                              d.content.deployments.map((d) => d.workspace),
                            )
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
                        branch: org.branch,
                      })),
                    )
                    .returning();

                  const deployments = parsedConfigFiles
                    .map((cf) =>
                      cf.content.deployments.map((d) => {
                        const info = deploymentInfo.find(
                          (i) =>
                            i.system.slug === d.system &&
                            i.workspace.slug === d.workspace,
                        );
                        if (info == null)
                          throw new TRPCError({
                            code: "NOT_FOUND",
                            message: "Deployment info not found",
                          });
                        const { system, workspace } = info;
                        console.log({ system, workspace });

                        return {
                          ...d,
                          systemId: system.id,
                          workspaceId: workspace.id,
                          description: d.description ?? "",
                          githubConfigFileId: insertedConfigFiles.find(
                            (icf) =>
                              icf.name === cf.name &&
                              icf.path === cf.path &&
                              icf.repositoryName === cf.repository.name,
                          )?.id,
                        };
                      }),
                    )
                    .flat();

                  return db.insert(deployment).values(deployments);
                }),
            ),
        ),
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: z.object({
            connected: z.boolean().optional(),
            installationId: z.number().optional(),
            organizationName: z.string().optional(),
            organizationId: z.string().optional(),
            addedByUserId: z.string().optional(),
            workspaceId: z.string().optional(),
          }),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db
          .update(githubOrganization)
          .set(input.data)
          .where(eq(githubOrganization.id, input.id)),
      ),

    repos: reposRouter,
  }),
});
