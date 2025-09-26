import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  eq,
  takeFirst,
  takeFirstOrNull,
  upsertDirectVariableValue,
  upsertReferenceVariableValue,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { resolveVariableValue } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const getVariableAndValues = async (tx: Tx, variableId: string) =>
  tx
    .select()
    .from(schema.deploymentVariable)
    .where(eq(schema.deploymentVariable.id, variableId))
    .leftJoin(
      schema.deploymentVariableValue,
      eq(
        schema.deploymentVariableValue.variableId,
        schema.deploymentVariable.id,
      ),
    )
    .then((rows) => {
      if (rows.length === 0) return null;
      const variable = rows[0]!.deployment_variable;
      const values = rows
        .map((r) => r.deployment_variable_value)
        .filter(isPresent);
      return { ...variable, values };
    });

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
      await eventDispatcher.dispatchDeploymentVariableValueCreated({
        ...insertedValue,
        isDefault: input.data.isDefault,
      });
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
      const { variableId } = await ctx.db
        .select()
        .from(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, input.id))
        .then(takeFirst);

      const prevVariable = await getVariableAndValues(ctx.db, variableId);
      if (prevVariable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      const updatedValue = await ctx.db.transaction((tx) =>
        upsertDirectVariableValue(tx, input.id, input.data),
      );
      const variable = await getVariableAndValues(ctx.db, variableId);
      if (variable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      await eventDispatcher.dispatchDeploymentVariableUpdated(
        prevVariable,
        variable,
      );
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
      const prevVariable = await getVariableAndValues(ctx.db, input.variableId);
      if (prevVariable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      const insertedValue = await ctx.db.transaction((tx) =>
        upsertReferenceVariableValue(tx, input.variableId, input.data),
      );
      const variable = await getVariableAndValues(ctx.db, input.variableId);
      if (variable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      await eventDispatcher.dispatchDeploymentVariableUpdated(
        prevVariable,
        variable,
      );
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
      const { variableId } = await ctx.db
        .select()
        .from(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, input.id))
        .then(takeFirst);
      const prevVariable = await getVariableAndValues(ctx.db, variableId);
      if (prevVariable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      const updatedValue = await ctx.db.transaction((tx) =>
        upsertReferenceVariableValue(tx, input.id, input.data),
      );
      const variable = await getVariableAndValues(ctx.db, variableId);
      if (variable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      await eventDispatcher.dispatchDeploymentVariableUpdated(
        prevVariable,
        variable,
      );
      return updatedValue;
    }),
});

const resolveForResource = protectedProcedure
  .input(
    z.object({
      resourceId: z.string().uuid(),
      valueId: z.string().uuid(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { resourceId, valueId } = input;
    const value = await ctx.db
      .select()
      .from(schema.deploymentVariableValue)
      .where(eq(schema.deploymentVariableValue.id, valueId))
      .then(takeFirst);

    const [directValue, referenceValue] = await Promise.all([
      ctx.db
        .select()
        .from(schema.deploymentVariableValueDirect)
        .where(
          eq(schema.deploymentVariableValueDirect.variableValueId, valueId),
        )
        .then(takeFirstOrNull),
      ctx.db
        .select()
        .from(schema.deploymentVariableValueReference)
        .where(
          eq(schema.deploymentVariableValueReference.variableValueId, valueId),
        )
        .then(takeFirstOrNull),
    ]);

    const variableValue = directValue ?? referenceValue ?? null;
    if (variableValue == null) return null;

    const fullValue = { ...variableValue, ...value };

    const variable = await ctx.db
      .select()
      .from(schema.deploymentVariable)
      .where(eq(schema.deploymentVariable.id, value.variableId))
      .then(takeFirst);

    const isDefault = variable.defaultValueId === valueId;

    return resolveVariableValue(
      ctx.db,
      resourceId,
      fullValue,
      isDefault,
      false,
    );
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
    .mutation(async ({ ctx, input }) => {
      const { variableId } = await ctx.db
        .select()
        .from(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, input))
        .then(takeFirst);

      const prevVariable = await getVariableAndValues(ctx.db, variableId);
      if (prevVariable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });

      const deletedValue = await ctx.db
        .delete(schema.deploymentVariableValue)
        .where(eq(schema.deploymentVariableValue.id, input))
        .returning()
        .then(takeFirst);

      const variable = await getVariableAndValues(ctx.db, variableId);
      if (variable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variable not found",
        });
      await eventDispatcher.dispatchDeploymentVariableUpdated(
        prevVariable,
        variable,
      );
      return deletedValue;
    }),
  resolveForResource,
});
