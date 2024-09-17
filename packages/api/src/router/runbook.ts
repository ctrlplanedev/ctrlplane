import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import { createRunbook, createRunbookVariable } from "@ctrlplane/db/schema";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const runbookRouter = createTRPCRouter({
  trigger: protectedProcedure.input(z.string()).mutation(() => {}),

  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.runbook)
        .leftJoin(
          SCHEMA.runbookVariable,
          eq(SCHEMA.runbookVariable.runbookId, SCHEMA.runbook.id),
        )
        .where(eq(SCHEMA.runbook.systemId, input))
        .then((rbs) =>
          _.chain(rbs)
            .groupBy((rb) => rb.runbook.id)
            .map((rb) => ({
              ...rb[0]!.runbook,
              variables: rb.map((v) => v.runbook_variable).filter(isPresent),
            }))
            .value(),
        ),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
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
});
