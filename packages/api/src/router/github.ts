import type { RestEndpointMethodTypes } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  githubEntity,
  githubEntityInsert,
  githubUser,
  jobAgent,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

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

type InstallationOctokitClient = ReturnType<typeof getOctokitInstallation>;

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

type Workflow =
  RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"][number];

type Repo =
  RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][number] & {
    workflows: Workflow[];
  };

const getWorkflows = async (
  page: number,
  fetchedWorkflows: Workflow[],
  repo: RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"][number],
  installationOctokit: InstallationOctokitClient,
  installationToken: { token: string },
) => {
  const { data } = await installationOctokit.actions.listRepoWorkflows({
    repo: repo.name,
    owner: repo.owner.login,
    page,
    per_page: 100,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
      authorization: `Bearer ${installationToken.token}`,
    },
  });
  const workflows = [...data.workflows, ...fetchedWorkflows];
  if (data.workflows.length < 100) return workflows;
  return getWorkflows(
    page + 1,
    workflows,
    repo,
    installationOctokit,
    installationToken,
  );
};

const getRepos = async (
  page: number,
  fetchedRepos: Repo[],
  installationOctokit: InstallationOctokitClient,
  installationToken: { token: string },
  owner: string,
) => {
  const { data } = await installationOctokit.repos.listForOrg({
    org: owner,
    per_page: 100,
    page,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
      authorization: `Bearer ${installationToken.token}`,
    },
  });

  const reposWithWorkflows = await Promise.all(
    data.map(async (repo) => {
      const workflows = await getWorkflows(
        1,
        [],
        repo,
        installationOctokit,
        installationToken,
      );
      return { ...repo, workflows };
    }),
  );

  const repos = [...reposWithWorkflows, ...fetchedRepos];
  if (reposWithWorkflows.length < 100) return repos;
  return getRepos(
    page + 1,
    repos,
    installationOctokit,
    installationToken,
    owner,
  );
};

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
    .query(async ({ input }) => {
      const { data: installation } = await getOctokit().apps.getInstallation({
        installation_id: input.installationId,
      });

      const installationOctokit = getOctokitInstallation(installation.id);
      const installationToken = (await installationOctokit.auth({
        type: "installation",
        installationId: installation.id,
      })) as { token: string };

      return getRepos(
        1,
        [],
        installationOctokit,
        installationToken,
        input.owner,
      );
    }),
});

export const githubRouter = createTRPCRouter({
  user: userRouter,

  entities: createTRPCRouter({
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
      .query(async ({ input }) => {
        const installations = await getOctokit().apps.listInstallations({
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });

        const orgPromises = installations.data
          .filter((i) => i.target_type === "Organization")
          .map(async (installation) => {
            const installationOctokit = getOctokitInstallation(installation.id);
            const installationToken = (await installationOctokit.auth({
              type: "installation",
              installationId: installation.id,
            })) as { token: string };

            type Member =
              RestEndpointMethodTypes["orgs"]["listMembers"]["response"]["data"][number];

            const getMembers = async (
              page: number,
              fetchedMembers: Member[],
            ): Promise<Member[]> => {
              const { data } = await installationOctokit.orgs.listMembers({
                org: installation.account?.login ?? "",
                per_page: 100,
                page,
                headers: {
                  "X-GitHub-Api-Version": "2022-11-28",
                  authorization: `Bearer ${installationToken.token}`,
                },
              });
              const members = [...data, ...fetchedMembers];
              if (data.length < 100) return members;
              return getMembers(page + 1, members);
            };

            const members = await getMembers(1, []);
            const isUserInGithubOrg =
              members.find((m) => m.id === input.githubUserId) != null;
            if (!isUserInGithubOrg) return null;

            const orgData = await installationOctokit.orgs.get({
              org: installation.account?.login ?? "",
              headers: {
                "X-GitHub-Api-Version": "2022-11-28",
              },
            });
            return {
              installationId: installation.id,
              type: "organization" as const,
              slug: orgData.data.login,
              avatarUrl: orgData.data.avatar_url,
            };
          });

        const orgs = await Promise.all(orgPromises);

        const personalEntityPromise = installations.data
          .filter((i) => i.target_type === "User")
          .map(async (installation) => {
            const installationOctokit = getOctokitInstallation(installation.id);

            const userData = (await installationOctokit.request(
              "GET /user/{account_id}",
              {
                account_id: installation.target_id.toString(),
                headers: { "X-GitHub-Api-Version": "2022-11-28" },
              },
            )) as { data: { login: string; avatar_url: string } };

            return {
              installationId: installation.id,
              type: "user" as const,
              slug: userData.data.login,
              avatarUrl: userData.data.avatar_url,
            };
          });

        const personalEntity = await Promise.all(personalEntityPromise).then(
          (entities) => entities.at(0),
        );

        return [...orgs, personalEntity].filter(isPresent);
      }),

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
          .from(githubEntity)
          .leftJoin(
            githubUser,
            eq(githubEntity.addedByUserId, githubUser.userId),
          )
          .where(eq(githubEntity.workspaceId, input))
          .then((orgs) =>
            orgs.map((o) => ({
              ...o.github_entity,
              addedByUser: o.github_user,
            })),
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
      .input(githubEntityInsert)
      .mutation(({ ctx, input }) =>
        ctx.db.transaction(async (db) => {
          const entity = await db
            .insert(githubEntity)
            .values({ ...input, addedByUserId: ctx.session.user.id })
            .returning()
            .then(takeFirst);

          await db.insert(jobAgent).values({
            workspaceId: entity.workspaceId,
            name: entity.slug,
            type: "github-app",
            config: {
              installationId: entity.installationId,
              owner: entity.slug,
            },
          });

          return entity;
        }),
      ),

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
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db.transaction(async (db) => {
          const deletedEntity = await db
            .delete(githubEntity)
            .where(eq(githubEntity.id, input.id))
            .returning()
            .then(takeFirstOrNull);

          if (deletedEntity == null)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Entity not found",
            });

          await db
            .delete(jobAgent)
            .where(
              and(
                eq(jobAgent.type, "github-app"),
                eq(jobAgent.name, deletedEntity.slug),
                eq(jobAgent.workspaceId, deletedEntity.workspaceId),
              ),
            );
        }),
      ),
    repos: reposRouter,
  }),
});
