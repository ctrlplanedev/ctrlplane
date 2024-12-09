import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, desc, eq, sql, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { dispatchRunbook } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { jobCondition } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const runbookRouter = createTRPCRouter({
  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.RunbookList).on({
          type: "runbook",
          id: input,
        }),
    })
    .query(({ ctx, input }) =>
      ctx.db.query.runbook.findFirst({
        where: eq(SCHEMA.runbook.id, input),
        with: { variables: true, runhooks: true },
      }),
    ),

  trigger: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser
          .perform(Permission.RunbookTrigger)
          .on({ type: "runbook", id: input.runbookId }),
    })
    .input(
      z.object({
        runbookId: z.string().uuid(),
        variables: z.record(z.any()),
      }),
    )
    .mutation(({ ctx, input: { runbookId, variables } }) =>
      dispatchRunbook(ctx.db, runbookId, variables),
    ),

  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser
          .perform(Permission.RunbookList)
          .on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.runbook.findMany({
        where: eq(SCHEMA.runbook.systemId, input),
        with: {
          runhooks: { with: { hook: true } },
          jobAgent: true,
          variables: true,
        },
      }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser
          .perform(Permission.RunbookCreate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(
      SCHEMA.createRunbook.extend({
        variables: z.array(SCHEMA.createRunbookVariable),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const { variables, ...rb } = input;
        const runbook = await tx
          .insert(SCHEMA.runbook)
          .values(rb)
          .returning()
          .then(takeFirst);

        const vars =
          variables.length === 0
            ? []
            : await tx
                .insert(SCHEMA.runbookVariable)
                .values(variables.map((v) => ({ ...v, runbookId: runbook.id })))
                .returning();
        return { ...runbook, variables: vars };
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.RunbookUpdate).on({
          type: "runbook",
          id: input.id,
        }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: SCHEMA.updateRunbook.extend({
          variables: z.array(SCHEMA.createRunbookVariable).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction((tx) =>
        tx
          .update(SCHEMA.runbook)
          .set(input.data)
          .where(eq(SCHEMA.runbook.id, input.id))
          .returning()
          .then(takeFirst)
          .then((rb) => {
            const vars = input.data.variables;
            if (vars == null || vars.length === 0) return rb;
            return tx
              .delete(SCHEMA.runbookVariable)
              .where(eq(SCHEMA.runbookVariable.runbookId, rb.id))
              .then(() =>
                tx
                  .insert(SCHEMA.runbookVariable)
                  .values(vars.map((v) => ({ ...v, runbookId: rb.id }))),
              )
              .then(() => rb);
          }),
      ),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.RunbookDelete).on({
          type: "runbook",
          id: input,
        }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db.delete(SCHEMA.runbook).where(eq(SCHEMA.runbook.id, input)),
    ),

  jobs: protectedProcedure
    .input(
      z.object({
        runbookId: z.string().uuid(),
        filter: jobCondition.optional(),
        limit: z.number().default(500),
        offset: z.number().default(0),
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.JobList).on({
          type: "runbook",
          id: input.runbookId,
        }),
    })
    .query(async ({ ctx, input }) => {
      const items = ctx.db
        .select()
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.runbookJobTrigger,
          eq(SCHEMA.job.id, SCHEMA.runbookJobTrigger.jobId),
        )
        .leftJoin(
          SCHEMA.jobVariable,
          eq(SCHEMA.jobVariable.jobId, SCHEMA.job.id),
        )
        .leftJoin(
          SCHEMA.jobMetadata,
          eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
        )
        .where(
          and(
            eq(SCHEMA.runbookJobTrigger.runbookId, input.runbookId),
            SCHEMA.runbookJobMatchesCondition(ctx.db, input.filter),
          ),
        )
        .orderBy(desc(SCHEMA.job.createdAt))
        .limit(input.limit)
        .offset(input.offset)
        .then((rows) =>
          _.chain(rows)
            .groupBy((j) => j.job.id)
            .map((j) => ({
              runbookJobTrigger: j[0]!.runbook_job_trigger,
              job: {
                ...j[0]!.job,
                variables: _.chain(j)
                  .map((v) => v.job_variable)
                  .filter(isPresent)
                  .uniqBy((v) => v.key)
                  .map((v) => ({
                    ...v,
                    value: v.sensitive ? "(sensitive)" : v.value,
                  }))
                  .value(),
                metadata: _.chain(j)
                  .map((v) => v.job_metadata)
                  .filter(isPresent)
                  .uniqBy((v) => v.key)
                  .value(),
              },
            }))
            .value(),
        );

      const total = ctx.db
        .select({ count: sql`COUNT(*)`.mapWith(Number) })
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.runbookJobTrigger,
          eq(SCHEMA.job.id, SCHEMA.runbookJobTrigger.jobId),
        )
        .where(
          and(
            eq(SCHEMA.runbookJobTrigger.runbookId, input.runbookId),
            SCHEMA.runbookJobMatchesCondition(ctx.db, input.filter),
          ),
        )
        .then(takeFirst)
        .then((t) => t.count);

      return Promise.all([items, total]).then(([items, total]) => ({
        items,
        total,
      }));
    }),
});
