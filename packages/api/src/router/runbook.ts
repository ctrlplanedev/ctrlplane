import { z } from "zod";

import { takeFirst } from "@ctrlplane/db";
import { createRunbook, createRunbookVariable } from "@ctrlplane/db/schema";
import * as SCHEMA from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const runbookRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      createRunbook.extend({
        variables: z.array(createRunbookVariable),
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
        const vars = await tx
          .insert(SCHEMA.runbookVariable)
          .values(variables.map((v) => ({ ...v, runbookId: runbook.id })))
          .returning();
        return { ...runbook, variables: vars };
      }),
    ),
});
