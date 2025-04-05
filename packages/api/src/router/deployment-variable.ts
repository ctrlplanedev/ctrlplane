import type { DeploymentVariableValue } from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  isNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createDeploymentVariable,
  createDeploymentVariableValue,
  deployment,
  deploymentVariable,
  deploymentVariableValue,
  resource,
  resourceMatchesMetadata,
  system,
  updateDeploymentVariable,
  updateDeploymentVariableValue,
} from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const updateDeploymentVariableQueue = getQueue(
  Channel.UpdateDeploymentVariable,
);

const valueRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const variable = await ctx.db
          .select()
          .from(deploymentVariable)
          .where(eq(deploymentVariable.id, input.variableId))
          .then(takeFirst);
        return canUser
          .perform(Permission.DeploymentVariableCreate)
          .on({ type: "deployment", id: variable.deploymentId });
      },
    })
    .input(createDeploymentVariableValue)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction((tx) =>
        tx
          .insert(deploymentVariableValue)
          .values(input)
          .returning()
          .then(takeFirst)
          .then(async (value) => {
            if (input.default)
              await tx
                .update(deploymentVariable)
                .set({ defaultValueId: value.id })
                .where(eq(deploymentVariable.id, input.variableId));
            const variable = await tx
              .select()
              .from(deploymentVariable)
              .where(eq(deploymentVariable.id, input.variableId))
              .then(takeFirst);
            await updateDeploymentVariableQueue.add(variable.id, variable);
            return value;
          }),
      ),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const value = await ctx.db
          .select()
          .from(deploymentVariableValue)
          .where(eq(deploymentVariableValue.id, input.id))
          .then(takeFirstOrNull);

        if (value == null) return false;

        return canUser.perform(Permission.DeploymentVariableUpdate).on({
          type: "deploymentVariable",
          id: value.variableId,
        });
      },
    })
    .input(
      z.object({ id: z.string().uuid(), data: updateDeploymentVariableValue }),
    )
    .mutation(async ({ ctx, input }) => {
      const { deployment_variable: variable } = await ctx.db
        .select()
        .from(deploymentVariableValue)
        .innerJoin(
          deploymentVariable,
          eq(deploymentVariableValue.variableId, deploymentVariable.id),
        )
        .where(eq(deploymentVariableValue.id, input.id))
        .then(takeFirst);

      const updatedValue = await ctx.db.transaction((tx) =>
        tx
          .update(deploymentVariableValue)
          .set(input.data)
          .where(eq(deploymentVariableValue.id, input.id))
          .returning()
          .then(takeFirst)
          .then(async (updatedValue) => {
            if (
              input.data.default &&
              variable.defaultValueId !== updatedValue.id
            )
              await tx
                .update(deploymentVariable)
                .set({ defaultValueId: updatedValue.id })
                .where(eq(deploymentVariable.id, updatedValue.variableId));

            if (
              input.data.default === false &&
              variable.defaultValueId === updatedValue.id
            )
              await tx
                .update(deploymentVariable)
                .set({ defaultValueId: null })
                .where(eq(deploymentVariable.id, updatedValue.variableId));

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
          .from(deploymentVariableValue)
          .innerJoin(
            deploymentVariable,
            eq(deploymentVariableValue.variableId, deploymentVariable.id),
          )
          .where(eq(deploymentVariableValue.id, input))
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
        .delete(deploymentVariableValue)
        .where(eq(deploymentVariableValue.id, input))
        .returning()
        .then(takeFirst);

      const variable = await ctx.db
        .select()
        .from(deploymentVariable)
        .where(eq(deploymentVariable.id, value.variableId))
        .then(takeFirst);

      await updateDeploymentVariableQueue.add(variable.id, variable);
      return value;
    }),
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

  byDeploymentId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const deploymentVariableValueSubquery = ctx.db
        .select({
          id: deploymentVariableValue.id,
          value: deploymentVariableValue.value,
          variableId: deploymentVariableValue.variableId,
          resourceSelector: deploymentVariableValue.resourceSelector,
        })
        .from(deploymentVariableValue)
        .orderBy(asc(deploymentVariableValue.value))
        .groupBy(deploymentVariableValue.id)
        .as("deployment_variable_value_subquery");

      return ctx.db
        .select({
          deploymentVariable: deploymentVariable,
          values: sql<DeploymentVariableValue[]>`
            coalesce(
              array_agg(
                case when ${deploymentVariableValueSubquery.id} is not null then
                  json_build_object(
                    'id', ${deploymentVariableValueSubquery.id},
                    'value', ${deploymentVariableValueSubquery.value},
                    'variableId', ${deploymentVariableValueSubquery.variableId},
                    'resourceSelector', ${deploymentVariableValueSubquery.resourceSelector}
                  )
                else null end
              ) filter (where ${deploymentVariableValueSubquery.id} is not null),
              array[]::json[]
            )
          `.as("values"),
        })
        .from(deploymentVariable)
        .leftJoin(
          deploymentVariableValueSubquery,
          eq(deploymentVariable.id, deploymentVariableValueSubquery.variableId),
        )
        .groupBy(deploymentVariable.id)
        .orderBy(asc(deploymentVariable.key))
        .where(eq(deploymentVariable.deploymentId, input));
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(createDeploymentVariable)
    .mutation(async ({ ctx, input }) => {
      const variable = await ctx.db
        .insert(deploymentVariable)
        .values(input)
        .returning()
        .then(takeFirst);

      if (input.config?.default) {
        const value = await ctx.db
          .insert(deploymentVariableValue)
          .values({
            variableId: variable.id,
            value: input.config.default,
          })
          .returning()
          .then(takeFirst);

        await ctx.db
          .update(deploymentVariable)
          .set({ defaultValueId: value.id })
          .where(eq(deploymentVariable.id, variable.id));
      }

      await updateDeploymentVariableQueue.add(variable.id, variable);
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
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(deploymentVariable)
        .set(input.data)
        .where(eq(deploymentVariable.id, input.id))
        .returning()
        .then(takeFirst)
        .then(async (variable) => {
          await updateDeploymentVariableQueue.add(variable.id, variable);
          return variable;
        }),
    ),

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
        .then(async (variable) => {
          await updateDeploymentVariableQueue.add(variable.id, variable);
          return variable;
        }),
    ),
});
