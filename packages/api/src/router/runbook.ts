import _ from "lodash";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import { createRunbook, createRunbookVariable } from "@ctrlplane/db/schema";
import * as SCHEMA from "@ctrlplane/db/schema";
import { dispatchRunbook } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const runbookRouter = createTRPCRouter({
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
    .input(createRunbook.extend({ variables: z.array(createRunbookVariable) }))
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
          variables: z.array(createRunbookVariable).optional(),
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
});
