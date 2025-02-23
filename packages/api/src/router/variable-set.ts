import { z } from "zod";

import { asc, eq, takeFirst } from "@ctrlplane/db";

import "@ctrlplane/db/schema";

import {
  createVariableSet,
  updateVariableSet,
  variableSet,
  variableSetEnvironment,
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
    .query(({ ctx, input }) =>
      ctx.db.query.variableSet.findMany({
        where: eq(variableSet.systemId, input),
        with: { values: true, environments: { with: { environment: true } } },
        orderBy: [asc(variableSet.name)],
      }),
    ),

  byEnvironmentId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.variableSetEnvironment.findMany({
        where: eq(variableSetEnvironment.environmentId, input),
        with: { variableSet: { with: { values: true } } },
      }),
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
      ctx.db.query.variableSet.findFirst({
        where: eq(variableSet.id, input),
        with: { values: true, environments: { with: { environment: true } } },
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
        await tx.insert(variableSetValue).values(
          input.values.map((value) => ({
            key: value.key,
            value: value.value,
            variableSetId: vs.id,
          })),
        );
        if (input.environmentIds.length > 0)
          await tx.insert(variableSetEnvironment).values(
            input.environmentIds.map((environmentId) => ({
              variableSetId: vs.id,
              environmentId,
            })),
          );
        return tx.query.variableSet.findFirst({
          where: eq(variableSet.id, vs.id),
          with: { values: true, environments: { with: { environment: true } } },
        });
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "variableSet", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateVariableSet,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        await tx
          .update(variableSet)
          .set(input.data)
          .where(eq(variableSet.id, input.id))
          .returning()
          .then(takeFirst);

        if (input.data.values != null) {
          await tx
            .delete(variableSetValue)
            .where(eq(variableSetValue.variableSetId, input.id));
          await tx.insert(variableSetValue).values(
            input.data.values.map((value) => ({
              key: value.key,
              value: value.value,
              variableSetId: input.id,
            })),
          );
        }

        if (input.data.environmentIds != null) {
          await tx
            .delete(variableSetEnvironment)
            .where(eq(variableSetEnvironment.variableSetId, input.id));
          await tx.insert(variableSetEnvironment).values(
            input.data.environmentIds.map((environmentId) => ({
              variableSetId: input.id,
              environmentId,
            })),
          );
        }
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
    .mutation(({ ctx, input }) =>
      ctx.db.delete(variableSet).where(eq(variableSet.id, input)),
    ),
});
