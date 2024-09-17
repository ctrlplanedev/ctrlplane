import type { RestEndpointMethodTypes } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
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
  jobAgent,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { env } from "../../config";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { createNewGithubOrganization } from "./create-github-org";

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

  delete: protectedProcedure
    .input(z.string())
    .mutation(({ ctx, input }) =>
      ctx.db.delete(githubUser).where(eq(githubUser.userId, input)),
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
      ctx.db.insert(githubUser).values(input).returning().then(takeFirst),
    ),
});

const reposRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.WorkspaceListIntegrations).on({
          type: "workspace",
          id: input.workspaceId,
        }),
    })
    .input(
      z.object({
        installationId: z.number(),
        owner: z.string(),
        workspaceId: z.string().uuid(),
      }),
    )
    .query(({ input }) =>
      octokit?.apps
        .getInstallation({
          installation_id: input.installationId,
        })
        .then(async ({ data: installation }) => {
          const installationOctokit = getOctokitInstallation(installation.id);
          const installationToken = (await installationOctokit.auth({
            type: "installation",
            installationId: installation.id,
          })) as { token: string };

          type Repo =
            RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][number];
          const repos: Repo[] = [];

          const getRepos = async (page: number) => {
            const { data } = await installationOctokit.repos.listForOrg({
              org: input.owner,
              per_page: 100,
              page,
              headers: {
                "X-GitHub-Api-Version": "2022-11-28",
                authorization: `Bearer ${installationToken.token}`,
              },
            });
            repos.push(...data);
            if (data.length < 100) return;
            return getRepos(page + 1);
          };

          await getRepos(1);
          return repos;
        }),
    ),

  workflows: createTRPCRouter({
    list: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.WorkspaceListIntegrations).on({
            type: "workspace",
            id: input.workspaceId,
          }),
      })
      .input(
        z.object({
          installationId: z.number(),
          owner: z.string(),
          repo: z.string(),
          workspaceId: z.string().uuid(),
        }),
      )
      .query(async ({ input }) => {
        const installationOctokit = getOctokitInstallation(
          input.installationId,
        );

        const installationToken = (await installationOctokit.auth({
          type: "installation",
          installationId: input.installationId,
        })) as { token: string };

        return installationOctokit.actions.listRepoWorkflows({
          ...input,
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
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.WorkspaceListIntegrations).on({
          type: "workspace",
          id: input,
        }),
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
    byGithubUserId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.WorkspaceListIntegrations).on({
            type: "workspace",
            id: input.workspaceId,
          }),
      })
      .input(
        z.object({
          githubUserId: z.number(),
          workspaceId: z.string().uuid(),
        }),
      )
      .query(({ input }) =>
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
                  const installationOctokit = getOctokitInstallation(i.id);

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
                    members.data.find((m) => m.id === input.githubUserId) !=
                    null;
                  if (!isUserInGithubOrg) return null;

                  const orgData = await installationOctokit.orgs.get({
                    org: i.account?.login ?? "",
                    headers: {
                      "X-GitHub-Api-Version": "2022-11-28",
                    },
                  });
                  return _.merge(orgData.data, { installationId: i.id });
                }),
            ).then((orgs) => orgs.filter(isPresent)),
          ),
      ),

    list: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.WorkspaceListIntegrations).on({
            type: "workspace",
            id: input,
          }),
      })
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .select()
          .from(githubOrganization)
          .leftJoin(
            githubUser,
            eq(githubOrganization.addedByUserId, githubUser.userId),
          )
          .leftJoin(
            githubConfigFile,
            eq(githubConfigFile.organizationId, githubOrganization.id),
          )
          .leftJoin(
            deployment,
            eq(deployment.githubConfigFileId, githubConfigFile.id),
          )
          .where(eq(githubOrganization.workspaceId, input))
          .then((rows) =>
            _.chain(rows)
              .groupBy("github_organization.id")
              .map((v) => ({
                ...v[0]!.github_organization,
                addedByUser: v[0]!.github_user,
                configFiles: v
                  .map((v) => v.github_config_file)
                  .filter(isPresent)
                  .map((cf) => ({
                    ...cf,
                    deployments: v
                      .map((v) => v.deployment)
                      .filter(isPresent)
                      .filter((d) => d.githubConfigFileId === cf.id),
                  })),
              }))
              .value(),
          ),
      ),

    create: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.WorkspaceUpdate).on({
            type: "workspace",
            id: input.workspaceId,
          }),
      })
      .input(githubOrganizationInsert)
      .mutation(({ ctx, input }) => createNewGithubOrganization(ctx.db, input)),

    delete: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.WorkspaceUpdate).on({
            type: "workspace",
            id: input.workspaceId,
          }),
      })
      .input(
        z.object({
          id: z.string().uuid(),
          workspaceId: z.string().uuid(),
          deleteDeployments: z.boolean(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db.transaction(async (db) => {
          const configFiles = await db
            .select()
            .from(githubConfigFile)
            .where(eq(githubConfigFile.organizationId, input.id));

          const deletedOrg = await db
            .delete(githubOrganization)
            .where(eq(githubOrganization.id, input.id))
            .returning()
            .then(takeFirstOrNull);

          if (deletedOrg == null)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Organization not found",
            });

          await db
            .delete(jobAgent)
            .where(
              and(
                eq(jobAgent.type, "github-app"),
                eq(jobAgent.name, deletedOrg.organizationName),
                eq(jobAgent.workspaceId, deletedOrg.workspaceId),
              ),
            );

          if (input.deleteDeployments)
            await db.delete(deployment).where(
              inArray(
                deployment.githubConfigFileId,
                configFiles.map((c) => c.id),
              ),
            );
        }),
      ),
    repos: reposRouter,
  }),
});
