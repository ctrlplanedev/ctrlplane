import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  eq,
  takeFirst,
  upsertDirectVariableValue,
  upsertReferenceVariableValue,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const updateDeploymentVariableQueue = getQueue(
  Channel.UpdateDeploymentVariable,
);

const addVariableToQueue = async (db: Tx, variableId: string) => {
  const variable = await db
    .select()
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.id, variableId))
    .then(takeFirst);

  await updateDeploymentVariableQueue.add(variable.id, variable);
};

const directValueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        variableId: z.string().uuid(),
        data: schema.createDirectDeploymentVariableValue,
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVariableValueCreate).on({
          type: "deploymentVariable",
          id: input.variableId,
        }),
    })
    .mutation(async ({ ctx, input }) => {
      const insertedValue = await ctx.db.transaction((tx) =>
        upsertDirectVariableValue(tx, input.variableId, input.data),
      );
      await addVariableToQueue(ctx.db, input.variableId);
      return insertedValue;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.createDirectDeploymentVariableValue,
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVariableValueUpdate).on({
          type: "deploymentVariableValue",
          id: input.id,
        }),
    })
    .mutation(async ({ ctx, input }) => {
      const updatedValue = await ctx.db.transaction((tx) =>
        upsertDirectVariableValue(tx, input.id, input.data),
      );
      await addVariableToQueue(ctx.db, updatedValue.variableId);
      return updatedValue;
    }),
});

const referenceValueRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        variableId: z.string().uuid(),
        data: schema.createReferenceDeploymentVariableValue,
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVariableValueCreate).on({
          type: "deploymentVariable",
          id: input.variableId,
        }),
    })
    .mutation(async ({ ctx, input }) => {
      const insertedValue = await ctx.db.transaction((tx) =>
        upsertReferenceVariableValue(tx, input.variableId, input.data),
      );
      await addVariableToQueue(ctx.db, input.variableId);
      return insertedValue;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.createReferenceDeploymentVariableValue,
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVariableValueUpdate).on({
          type: "deploymentVariableValue",
          id: input.id,
        }),
    })
    .mutation(async ({ ctx, input }) => {
      const updatedValue = await ctx.db.transaction((tx) =>
        upsertReferenceVariableValue(tx, input.id, input.data),
      );
      await addVariableToQueue(ctx.db, updatedValue.variableId);
      return updatedValue;
    }),
});

export const valueRouter = createTRPCRouter({
  direct: directValueRouter,
  reference: referenceValueRouter,
  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVariableValueDelete).on({
          type: "deploymentVariableValue",
          id: input,
        }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, input)),
    ),
});
