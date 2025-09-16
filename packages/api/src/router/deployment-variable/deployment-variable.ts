import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  isNull,
  takeFirst,
  takeFirstOrNull,
  upsertDeploymentVariable,
} from "@ctrlplane/db";
import {
  createDeploymentVariable,
  deployment,
  deploymentVariable,
  deploymentVariableValue,
  resource,
  resourceMatchesMetadata,
  system,
  updateDeploymentVariable,
} from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { byDeploymentId } from "./by-deployment-id";
import { valueRouter } from "./deployment-variable-value";

const getVariableAndValues = async (tx: Tx, variableId: string) =>
  tx
    .select()
    .from(schema.deploymentVariable)
    .leftJoin(
      schema.deploymentVariableValue,
      eq(
        schema.deploymentVariableValue.variableId,
        schema.deploymentVariable.id,
      ),
    )
    .where(eq(schema.deploymentVariable.id, variableId))
    .then((rows) => {
      if (rows.length === 0) return null;
      const variable = rows[0]!.deployment_variable;
      const values = rows
        .map((r) => r.deployment_variable_value)
        .filter(isPresent);
      return { ...variable, values };
    });

export const deploymentVariableRouter = createTRPCRouter({
  value: valueRouter,

  byResourceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const deploymentVariables = await ctx.db
        .select()
        .from(resource)
        .innerJoin(system, eq(resource.workspaceId, system.workspaceId))
        .innerJoin(deployment, eq(deployment.systemId, system.id))
        .innerJoin(
          deploymentVariable,
          eq(deploymentVariable.deploymentId, deployment.id),
        )
        .innerJoin(
          deploymentVariableValue,
          eq(deploymentVariableValue.variableId, deploymentVariable.id),
        )
        .where(and(eq(resource.id, input), isNull(resource.deletedAt)))
        .orderBy(asc(deploymentVariable.key))
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.deployment_variable.id)
            .map((r) => ({
              ...r[0]!.deployment_variable,
              resourceSelector:
                r[0]!.deployment_variable_value.resourceSelector,
              value: r[0]!.deployment_variable_value,
              deployment: { ...r[0]!.deployment, system: r[0]!.system },
            }))
            .value(),
        );

      return Promise.all(
        deploymentVariables.map(async (deploymentVariable) => {
          const { resourceSelector } = deploymentVariable;

          const tg = await ctx.db
            .select()
            .from(resource)
            .where(
              and(
                eq(resource.id, input),
                isNull(resource.deletedAt),
                resourceMatchesMetadata(ctx.db, resourceSelector),
              ),
            )
            .then(takeFirstOrNull);

          if (tg == null) return null;

          return {
            ...deploymentVariable,
            value: deploymentVariable.value,
          };
        }),
      ).then((rows) => rows.filter(isPresent));
    }),

  byDeploymentId,

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        data: createDeploymentVariable,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { deploymentId, data } = input;
      const variable = await upsertDeploymentVariable(deploymentId, data);
      const fullVar = await getVariableAndValues(ctx.db, variable.id);
      if (fullVar == null) throw new Error("Variable not found");
      await eventDispatcher.dispatchDeploymentVariableCreated(fullVar);
      return variable;
    }),

  update: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVariableUpdate)
          .on({ type: "deploymentVariable", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateDeploymentVariable }))
    .mutation(async ({ ctx, input }) => {
      const prevVariable = await getVariableAndValues(ctx.db, input.id);
      if (prevVariable == null) throw new Error("Variable not found");

      const updatedVariable = await ctx.db
        .update(deploymentVariable)
        .set(input.data)
        .where(eq(deploymentVariable.id, input.id))
        .returning()
        .then(takeFirst);
      const fullVar = await getVariableAndValues(ctx.db, updatedVariable.id);
      if (fullVar == null) throw new Error("Variable not found");
      await eventDispatcher.dispatchDeploymentVariableUpdated(
        prevVariable,
        fullVar,
      );
      return updatedVariable;
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVariableDelete).on({
          type: "deploymentVariable",
          id: input,
        }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(deploymentVariable)
        .where(eq(deploymentVariable.id, input))
        .returning()
        .then(takeFirst)
        .then((variable) => {
          eventDispatcher.dispatchDeploymentVariableDeleted(variable);
        }),
    ),
});
