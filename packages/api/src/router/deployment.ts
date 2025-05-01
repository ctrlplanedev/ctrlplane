import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { updateDeployment } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentStatsRouter } from "./deployment-stats";
import { deploymentVariableRouter } from "./deployment-variable";
import { versionRouter } from "./deployment-version";

const hookRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.HookList).on({
          type: "deployment",
          id: input,
        }),
    })
    .query(({ ctx, input }) =>
      ctx.db.query.hook
        .findMany({
          where: and(
            eq(SCHEMA.hook.scopeId, input),
            eq(SCHEMA.hook.scopeType, "deployment"),
          ),
          with: { runhooks: { with: { runbook: true } } },
        })
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            runhook: row.runhooks[0] ?? null,
          })),
        ),
    ),

  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const h = await ctx.db
          .select()
          .from(SCHEMA.hook)
          .where(eq(SCHEMA.hook.id, input))
          .then(takeFirstOrNull);
        if (h == null) return false;
        if (h.scopeType !== "deployment") return false;
        return canUser.perform(Permission.HookGet).on({
          type: "deployment",
          id: h.scopeId,
        });
      },
    })
    .query(({ ctx, input }) =>
      ctx.db.query.hook.findFirst({ where: eq(SCHEMA.hook.id, input) }),
    ),

  create: protectedProcedure
    .input(SCHEMA.createHook)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.HookCreate)
          .on({ type: "deployment", id: input.scopeId }),
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const dep = await tx
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, input.scopeId))
          .then(takeFirst);
        const h = await tx
          .insert(SCHEMA.hook)
          .values(input)
          .returning()
          .then(takeFirst);
        const { jobAgentId, jobAgentConfig } = input;
        if (jobAgentId == null || jobAgentConfig == null)
          return { ...h, runhook: null };

        const rb = await tx
          .insert(SCHEMA.runbook)
          .values({
            name: h.name,
            systemId: dep.systemId,
            jobAgentId,
            jobAgentConfig,
          })
          .returning()
          .then(takeFirst);

        if (input.variables.length > 0)
          await tx
            .insert(SCHEMA.runbookVariable)
            .values(input.variables.map((v) => ({ ...v, runbookId: rb.id })))
            .returning();

        const rh = await tx
          .insert(SCHEMA.runhook)
          .values({ hookId: h.id, runbookId: rb.id })
          .returning()
          .then(takeFirst);

        await getQueue(Channel.NewDeployment).add(dep.id, dep);

        return { ...h, runhook: rh };
      }),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: SCHEMA.updateHook }))
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const h = await ctx.db
          .select()
          .from(SCHEMA.hook)
          .where(eq(SCHEMA.hook.id, input.id))
          .then(takeFirstOrNull);
        if (h == null) return false;
        if (h.scopeType !== "deployment") return false;
        return canUser.perform(Permission.HookUpdate).on({
          type: "deployment",
          id: h.scopeId,
        });
      },
    })
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const h = await tx
          .update(SCHEMA.hook)
          .set(input.data)
          .where(eq(SCHEMA.hook.id, input.id))
          .returning()
          .then(takeFirst);

        const dep = await tx
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, h.scopeId))
          .then(takeFirst);

        const rh = await tx
          .select()
          .from(SCHEMA.runhook)
          .where(eq(SCHEMA.runhook.hookId, h.id))
          .then(takeFirstOrNull);

        if (rh != null)
          await tx
            .delete(SCHEMA.runbook)
            .where(eq(SCHEMA.runbook.id, rh.runbookId));

        const { jobAgentId, jobAgentConfig } = input.data;
        if (jobAgentId == null || jobAgentConfig == null) {
          return { ...h, runhook: null };
        }

        const rb = await tx
          .insert(SCHEMA.runbook)
          .values({
            name: h.name,
            systemId: dep.systemId,
            jobAgentId,
            jobAgentConfig,
          })
          .returning()
          .then(takeFirst);

        if (input.data.variables != null && input.data.variables.length > 0)
          await tx
            .insert(SCHEMA.runbookVariable)
            .values(
              input.data.variables.map((v) => ({ ...v, runbookId: rb.id })),
            )
            .returning();

        const updatedRh = await tx
          .insert(SCHEMA.runhook)
          .values({ hookId: h.id, runbookId: rb.id })
          .returning()
          .then(takeFirst);
        return { ...h, runhook: updatedRh };
      }),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const h = await ctx.db
          .select()
          .from(SCHEMA.hook)
          .where(eq(SCHEMA.hook.id, input))
          .then(takeFirstOrNull);
        if (h == null) return false;
        if (h.scopeType !== "deployment") return false;
        return canUser.perform(Permission.HookDelete).on({
          type: "deployment",
          id: h.scopeId,
        });
      },
    })
    .mutation(({ ctx, input }) =>
      ctx.db.delete(SCHEMA.hook).where(eq(SCHEMA.hook.id, input)),
    ),
});

export const deploymentRouter = createTRPCRouter({
  variable: deploymentVariableRouter,
  hook: hookRouter,
  version: versionRouter,
  distributionById: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) => {
      const latestJobsPerResource = ctx.db
        .select({
          id: SCHEMA.job.id,
          status: SCHEMA.job.status,
          resourceId: SCHEMA.releaseJobTrigger.resourceId,
          rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${SCHEMA.releaseJobTrigger.resourceId} ORDER BY ${SCHEMA.job.createdAt} DESC)`.as(
            "rank",
          ),
        })
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .as("latest_jobs");

      return ctx.db
        .select()
        .from(latestJobsPerResource)
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, latestJobsPerResource.id),
        )
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.deploymentVersion.id, SCHEMA.releaseJobTrigger.versionId),
        )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.resource.id, SCHEMA.releaseJobTrigger.resourceId),
        )
        .where(
          and(
            eq(SCHEMA.deploymentVersion.deploymentId, input),
            eq(latestJobsPerResource.rank, 1),
            isNull(SCHEMA.resource.deletedAt),
          ),
        )
        .then((r) =>
          r.map((row) => ({
            ...row.latest_jobs,
            version: row.deployment_version,
            resource: row.resource,
            releaseJobTrigger: row.release_job_trigger,
          })),
        );
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentCreate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(SCHEMA.createDeployment)
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(SCHEMA.deployment)
        .values({ ...input, description: input.description ?? "" })
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: SCHEMA.updateDeployment }))
    .mutation(({ ctx, input }) =>
      updateDeployment(input.id, input.data, ctx.session.user.id),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentDelete)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ input }) =>
      getQueue(Channel.DeleteDeployment).add(
        input,
        { id: input },
        { deduplication: { id: input } },
      ),
    ),

  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.deployment)
        .where(eq(SCHEMA.deployment.id, input))
        .then(takeFirst),
    ),

  bySlug: protectedProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        deploymentSlug: z.string(),
        systemSlug: z.string(),
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const { workspaceSlug, deploymentSlug, systemSlug } = input;
        const sys = await ctx.db
          .select()
          .from(SCHEMA.deployment)
          .innerJoin(
            SCHEMA.system,
            eq(SCHEMA.system.id, SCHEMA.deployment.systemId),
          )
          .innerJoin(
            SCHEMA.workspace,
            eq(SCHEMA.system.workspaceId, SCHEMA.workspace.id),
          )
          .leftJoin(
            SCHEMA.jobAgent,
            eq(SCHEMA.jobAgent.id, SCHEMA.deployment.jobAgentId),
          )
          .where(
            and(
              eq(SCHEMA.deployment.slug, deploymentSlug),
              eq(SCHEMA.system.slug, systemSlug),
              eq(SCHEMA.workspace.slug, workspaceSlug),
            ),
          )
          .then(takeFirstOrNull);
        if (sys == null) return null;
        return canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "system", id: sys.system.id });
      },
    })
    .query(({ ctx, input: { workspaceSlug, deploymentSlug, systemSlug } }) =>
      ctx.db
        .select()
        .from(SCHEMA.deployment)
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.system.id, SCHEMA.deployment.systemId),
        )
        .innerJoin(
          SCHEMA.workspace,
          eq(SCHEMA.system.workspaceId, SCHEMA.workspace.id),
        )
        .leftJoin(
          SCHEMA.jobAgent,
          eq(SCHEMA.jobAgent.id, SCHEMA.deployment.jobAgentId),
        )
        .leftJoin(
          SCHEMA.deploymentVersionChannel,
          eq(
            SCHEMA.deploymentVersionChannel.deploymentId,
            SCHEMA.deployment.id,
          ),
        )
        .where(
          and(
            eq(SCHEMA.deployment.slug, deploymentSlug),
            eq(SCHEMA.system.slug, systemSlug),
            eq(SCHEMA.workspace.slug, workspaceSlug),
          ),
        )
        .then((r) =>
          r[0] == null
            ? null
            : {
                ...r[0].deployment,
                system: { ...r[0].system, workspace: r[0].workspace },
                agent: r[0].job_agent,
                versionChannels: r
                  .map((r) => r.deployment_version_channel)
                  .filter(isPresent),
              },
        ),
    ),

  bySystemId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "system", id: input }),
    })
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(SCHEMA.deployment)
        .leftJoin(
          SCHEMA.deploymentVersionChannel,
          eq(
            SCHEMA.deploymentVersionChannel.deploymentId,
            SCHEMA.deployment.id,
          ),
        )
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
        )
        .where(eq(SCHEMA.deployment.systemId, input))
        .orderBy(SCHEMA.deployment.name)
        .then((ts) =>
          _.chain(ts)
            .groupBy((t) => t.deployment.id)
            .map((t) => ({
              ...t[0]!.deployment,
              system: t[0]!.system,
              versionChannels: _.chain(t)
                .map((a) => a.deployment_version_channel)
                .filter(isPresent)
                .uniqBy((a) => a.id)
                .value(),
            }))
            .value(),
        );
    }),

  byResourceId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "resource", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const tg = await ctx.db
        .select()
        .from(SCHEMA.resource)
        .where(
          and(eq(SCHEMA.resource.id, input), isNull(SCHEMA.resource.deletedAt)),
        )
        .then(takeFirst);

      const envs = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.environment.systemId, SCHEMA.system.id),
        )
        .where(
          and(
            eq(SCHEMA.system.workspaceId, tg.workspaceId),
            isNotNull(SCHEMA.environment.resourceSelector),
          ),
        );

      return Promise.all(
        envs.map((env) =>
          ctx.db
            .select()
            .from(SCHEMA.deployment)
            .innerJoin(
              SCHEMA.system,
              eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
            )
            .innerJoin(
              SCHEMA.environment,
              eq(SCHEMA.environment.systemId, SCHEMA.system.id),
            )
            .leftJoin(
              SCHEMA.deploymentVersion,
              eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
            )
            .innerJoin(
              SCHEMA.resource,
              SCHEMA.resourceMatchesMetadata(
                ctx.db,
                env.environment.resourceSelector,
              ),
            )
            .leftJoin(
              SCHEMA.releaseJobTrigger,
              and(
                eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
                eq(
                  SCHEMA.releaseJobTrigger.versionId,
                  SCHEMA.deploymentVersion.id,
                ),
                eq(
                  SCHEMA.releaseJobTrigger.environmentId,
                  SCHEMA.environment.id,
                ),
              ),
            )
            .leftJoin(
              SCHEMA.job,
              eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
            )
            .where(
              and(
                eq(SCHEMA.resource.id, input),
                eq(SCHEMA.environment.id, env.environment.id),
                isNull(SCHEMA.resource.deletedAt),
                inArray(SCHEMA.job.status, [
                  JobStatus.Successful,
                  JobStatus.Pending,
                  JobStatus.InProgress,
                ]),
              ),
            )
            .orderBy(SCHEMA.deployment.id, SCHEMA.releaseJobTrigger.createdAt)
            .limit(500)
            .then((r) =>
              r.map((row) => ({
                ...row.deployment,
                environment: row.environment,
                system: row.system,
                releaseJobTrigger:
                  row.release_job_trigger != null
                    ? {
                        ...row.release_job_trigger,
                        job: row.job!,
                        version: row.deployment_version!,
                        resourceId: row.resource.id,
                      }
                    : null,
              })),
            ),
        ),
      ).then((r) => r.flat());
    }),

  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.deployment)
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.system.id, SCHEMA.deployment.systemId),
        )
        .where(eq(SCHEMA.system.workspaceId, input))
        .then((r) =>
          r.map((row) => ({
            ...row.deployment,
            system: row.system,
          })),
        ),
    ),

  stats: deploymentStatsRouter,
});
