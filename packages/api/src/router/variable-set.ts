import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";

import "@ctrlplane/db/schema";

import {
  createVariableSet,
  updateVariableSet,
  variableSet,
  variableSetValue,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const variableSetRouter = createTRPCRouter({
  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(variableSet)
        .leftJoin(
          variableSetValue,
          eq(variableSetValue.variableSetId, variableSet.id),
        )
        .where(eq(variableSet.systemId, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.variable_set.id)
            .entries()
            .map(([, rows]) => ({
              ...rows[0]!.variable_set,
              values: rows
                .map((row) => row.variable_set_value)
                .filter(isPresent),
            }))
            .value(),
        ),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "variableSet", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(variableSet)
        .leftJoin(
          variableSetValue,
          eq(variableSetValue.variableSetId, variableSet.id),
        )
        .where(eq(variableSet.id, input))
        .then((rows) => {
          if (rows.length === 0) return null;
          return {
            ...rows[0]!.variable_set,
            values: rows.map((row) => row.variable_set_value).filter(isPresent),
          };
        }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createVariableSet)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const vs = await tx
          .insert(variableSet)
          .values(input)
          .returning()
          .then(takeFirst);
        const values = await tx
          .insert(variableSetValue)
          .values(
            input.values.map((value) => ({ ...value, variableSetId: vs.id })),
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
          .on({ type: "variableSet", id: input }),
    })
    .input(z.string().uuid())
    .mutation(() => {}),

  set: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "variableSet", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateVariableSet.and(
          z.object({ values: z.record(z.string()).optional() }),
        ),
      }),
    )
    .mutation(() => {}),
});
