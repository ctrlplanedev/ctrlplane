import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const updateDeploymentVariableQueue = getQueue(
  Channel.UpdateDeploymentVariable,
);

export const valueRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.deploymentVariable)
          .where(eq(schema.deploymentVariable.id, input.variableId))
          .then(takeFirst);
        return canUser
          .perform(Permission.DeploymentVariableCreate)
          .on({ type: "deployment", id: variable.deploymentId });
      },
    })
    .input(
      z.object({
        variableId: z.string().uuid(),
        data: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { variableId, data } = input;
      const variable = await ctx.db.query.deploymentVariable.findFirst({
        where: eq(schema.deploymentVariable.id, variableId),
      });
      if (variable == null) throw new Error("Variable not found");
      const valueInsert = { ...data, variableId };
      console.log(valueInsert);
      // const value = await upsertVariableValue(ctx.db, valueInsert);
      // await updateDeploymentVariableQueue.add(variableId, variable);
      // return value;
    }),

  update: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const value = await ctx.db
          .select()
          .from(schema.deploymentVariableValue)
          .where(eq(schema.deploymentVariableValue.id, input.id))
          .then(takeFirstOrNull);

        if (value == null) return false;

        return canUser.perform(Permission.DeploymentVariableUpdate).on({
          type: "deploymentVariable",
          id: value.variableId,
        });
      },
    })
    .input(z.object({ id: z.string().uuid(), data: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const { deployment_variable: variable } = await ctx.db
        .select()
        .from(schema.deploymentVariableValue)
        .innerJoin(
          schema.deploymentVariable,
          eq(
            schema.deploymentVariableValue.variableId,
            schema.deploymentVariable.id,
          ),
        )
        .where(eq(schema.deploymentVariableValue.id, input.id))
        .then(takeFirst);

      const updatedValue = await ctx.db.transaction((tx) =>
        tx
          .update(schema.deploymentVariableValue)
          .set(input.data)
          .where(eq(schema.deploymentVariableValue.id, input.id))
          .returning()
          .then(takeFirst)
          .then(async (updatedValue) => {
            if (
              input.data.default &&
              variable.defaultValueId !== updatedValue.id
            )
              await tx
                .update(schema.deploymentVariable)
                .set({ defaultValueId: updatedValue.id })
                .where(
                  eq(schema.deploymentVariable.id, updatedValue.variableId),
                );

            if (
              input.data.default === false &&
              variable.defaultValueId === updatedValue.id
            )
              await tx
                .update(schema.deploymentVariable)
                .set({ defaultValueId: null })
                .where(
                  eq(schema.deploymentVariable.id, updatedValue.variableId),
                );

            return updatedValue;
          }),
      );

      await updateDeploymentVariableQueue.add(variable.id, variable);
      return updatedValue;
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const value = await ctx.db
          .select()
          .from(schema.deploymentVariableValue)
          .innerJoin(
            schema.deploymentVariable,
            eq(
              schema.deploymentVariableValue.variableId,
              schema.deploymentVariable.id,
            ),
          )
          .where(eq(schema.deploymentVariableValue.id, input))
          .then(takeFirst);
        return canUser.perform(Permission.DeploymentVariableUpdate).on({
          type: "deployment",
          id: value.deployment_variable.deploymentId,
        });
      },
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      const value = await ctx.db
        .delete(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, input))
        .returning()
        .then(takeFirst);

      const variable = await ctx.db
        .select()
        .from(schema.deploymentVariable)
        .where(eq(schema.deploymentVariable.id, value.variableId))
        .then(takeFirst);

      await updateDeploymentVariableQueue.add(variable.id, variable);
      return value;
    }),
});
