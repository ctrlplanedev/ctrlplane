import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createValueSet,
  updateValueSet,
  value,
  valueSet,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const valueSetRouter = createTRPCRouter({
  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(valueSet)
        .leftJoin(value, eq(value.valueSetId, valueSet.id))
        .where(eq(valueSet.systemId, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy("valueSetId")
            .entries()
            .map(([, rows]) => ({
              ...rows[0]!.value_set,
              values: rows.map((row) => row.value).filter(isPresent),
            }))
            .value(),
        ),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createValueSet)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (db) => {
        const vs = await db
          .insert(valueSet)
          .values(input)
          .returning()
          .then(takeFirst);
        const values = await db
          .insert(value)
          .values(
            input.values.map((value) => ({ ...value, valueSetId: vs.id })),
          )
          .returning();
        return { ...vs, values };
      }),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "valueSet", id: input }),
    })
    .input(z.string().uuid())
    .mutation(() => {}),

  set: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "valueSet", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateValueSet.and(
          z.object({ values: z.record(z.string()).optional() }),
        ),
      }),
    )
    .mutation(() => {}),
});
