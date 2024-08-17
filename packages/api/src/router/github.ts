import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import {
  githubOrganization,
  githubOrganizationInsert,
  githubUser,
} from "@ctrlplane/db/schema";

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

          console.log({ login: input.login });

          const searchResponse = await installationOctokit.search.code({
            q: `org:${input.login} filename:example.ctrlplane.yaml`,
            per_page: 100,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
              authorization: `Bearer ${installationToken.token}`,
            },
          });

          console.log({ searchResponseData: searchResponse.data.items });

          return installationOctokit.repos.listForOrg({
            org: input.login,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
              authorization: `Bearer ${installationToken.token}`,
            },
          });
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

export const githubRouter = createTRPCRouter({
  user: userRouter,

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
        ctx.db.insert(githubOrganization).values(input).returning(),
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
