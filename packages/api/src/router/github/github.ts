import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import {
  deployment,
  githubConfigFile,
  githubOrganization,
  githubOrganizationInsert,
  githubUser,
  jobAgent,
} from "@ctrlplane/db/schema";

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
    .mutation(async ({ ctx, input }) =>
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
      ctx.db
        .insert(githubUser)
        .values(input)
        .returning()
        .then((data) => data[0]),
    ),
});

const reposRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ installationId: z.number(), owner: z.string() }))
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

          const { data } = await installationOctokit.repos.listForOrg({
            org: input.owner,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
              authorization: `Bearer ${installationToken.token}`,
            },
          });
          return data;
        }),
    ),

  workflows: createTRPCRouter({
    list: protectedProcedure
      .input(
        z.object({
          installationId: z.number(),
          owner: z.string(),
          repo: z.string(),
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
                  members.data.find((m) => m.id === input) != null;
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

    list: protectedProcedure.input(z.string().uuid()).query(({ ctx, input }) =>
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
      .input(githubOrganizationInsert)
      .mutation(({ ctx, input }) => createNewGithubOrganization(ctx.db, input)),

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

    delete: protectedProcedure
      .input(
        z.object({ id: z.string().uuid(), deleteDeployments: z.boolean() }),
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
