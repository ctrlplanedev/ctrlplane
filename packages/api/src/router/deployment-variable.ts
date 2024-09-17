import _ from "lodash";
import { z } from "zod";

import {
  and,
  arrayContains,
  eq,
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
  deploymentVariableValueTarget,
  deploymentVariableValueTargetFilter,
  environment,
  system,
  target,
  updateDeploymentVariable,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

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
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: variable.deploymentId });
      },
    })
    .input(createDeploymentVariableValue)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(deploymentVariableValue).values(input).returning(),
    ),

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
        return canUser.perform(Permission.DeploymentUpdate).on({
          type: "deployment",
          id: value.deployment_variable.deploymentId,
        });
      },
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      // Note: Due to cascading deletes set up in the schema, this will also delete:
      // - All deploymentVariableValueTarget entries for this value
      // - All deploymentVariableValueTargetFilter entries for those targets

      return ctx.db
        .delete(deploymentVariableValue)
        .where(eq(deploymentVariableValue.id, input))
        .returning()
        .then(takeFirstOrNull);
    }),

  setTarget: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "target", id: input.targetId }),
    })
    .input(
      z.object({
        targetId: z.string().uuid(),
        variableId: z.string().uuid(),
        value: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.value == null) {
        const vv = await ctx.db
          .select()
          .from(deploymentVariableValue)
          .innerJoin(
            deploymentVariableValueTarget,
            eq(
              deploymentVariableValue.id,
              deploymentVariableValueTarget.variableValueId,
            ),
          )
          .where(
            and(
              eq(deploymentVariableValue.variableId, input.variableId),
              eq(deploymentVariableValueTarget.targetId, input.targetId),
            ),
          )
          .then(takeFirstOrNull);

        if (vv == null)
          // value is already not set.
          return;

        return ctx.db
          .delete(deploymentVariableValueTarget)
          .where(
            and(
              eq(
                deploymentVariableValueTarget.variableValueId,
                vv.deployment_variable_value.id,
              ),
              eq(deploymentVariableValueTarget.targetId, input.targetId),
            ),
          )
          .returning();
      }

      const value = await ctx.db
        .insert(deploymentVariableValue)
        .values({ variableId: input.variableId, value: input.value })
        .onConflictDoUpdate({
          target: [
            deploymentVariableValue.variableId,
            deploymentVariableValue.value,
          ],
          set: { value: input.value },
        })
        .returning()
        .then(takeFirst);

      return ctx.db
        .insert(deploymentVariableValueTarget)
        .values({
          variableValueId: value.id,
          targetId: input.targetId,
        })
        .returning();
    }),

  byTargetId: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const variableValuesQuery = ctx.db
        .selectDistinctOn([deploymentVariable.id], {
          variableId: deploymentVariable.id,
          variableValueId: sql<
            string | null
          >`COALESCE(variable_value_target.variable_value_id, variable_value_target_filter.variable_value_id)`.as(
            `variable_value_id`,
          ),
        })
        .from(deploymentVariable)
        .leftJoin(
          deploymentVariableValue,
          eq(deploymentVariable.id, deploymentVariableValue.variableId),
        )
        .leftJoin(
          deploymentVariableValueTarget,
          eq(
            deploymentVariableValue.id,
            deploymentVariableValueTarget.variableValueId,
          ),
        )
        .leftJoin(
          deploymentVariableValueTargetFilter,
          eq(
            deploymentVariableValueTargetFilter.variableValueId,
            deploymentVariableValue.id,
          ),
        )
        .leftJoin(
          deployment,
          eq(deployment.id, deploymentVariable.deploymentId),
        )
        .leftJoin(environment, eq(environment.systemId, deployment.systemId))
        .innerJoin(
          target,
          arrayContains(target.labels, environment.targetFilter),
        )
        .where(eq(target.id, input))
        .as("variable_values_query");

      return ctx.db
        .select()
        .from(variableValuesQuery)
        .innerJoin(
          deploymentVariable,
          eq(deploymentVariable.id, variableValuesQuery.variableId),
        )
        .leftJoin(
          deploymentVariableValue,
          eq(deploymentVariableValue.id, variableValuesQuery.variableValueId),
        )
        .then((rows) =>
          rows.map((row) => ({
            ...row.deployment_variable,
            ...row.deployment_variable_value,
            variableId: row.deployment_variable.id,
            valueId: row.deployment_variable_value?.id,
          })),
        );
    }),
});

export const deploymentVariableRouter = createTRPCRouter({
  value: valueRouter,

  byTargetId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) => {
      return ctx.db
        .select()
        .from(deploymentVariable)
        .leftJoin(
          deploymentVariableValue,
          eq(deploymentVariable.id, deploymentVariableValue.variableId),
        )
        .innerJoin(
          deployment,
          eq(deployment.id, deploymentVariable.deploymentId),
        )
        .innerJoin(system, eq(system.id, deployment.systemId))
        .innerJoin(environment, eq(environment.systemId, system.id))
        .innerJoin(
          target,
          arrayContains(target.labels, environment.targetFilter),
        )
        .where(eq(target.id, input))
        .then((rows) => {
          return _.chain(rows)
            .groupBy((row) => row.deployment_variable.id)
            .map((row) => ({
              ...row[0]!.deployment_variable,
              values: _.chain(row)
                .groupBy((r) => r.deployment_variable_value?.id)
                .map((r) => ({ ...r[0]!.deployment_variable_value! }))
                .value(),
            }))
            .value();
        });
    }),

  byDeploymentId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(deploymentVariable)
        .leftJoin(
          deploymentVariableValue,
          eq(deploymentVariable.id, deploymentVariableValue.variableId),
        )
        .leftJoin(
          deploymentVariableValueTarget,
          eq(
            deploymentVariableValueTarget.variableValueId,
            deploymentVariableValue.id,
          ),
        )
        .where(eq(deploymentVariable.deploymentId, input))
        .then((rows) => {
          return _.chain(rows)
            .groupBy((row) => row.deployment_variable.id)
            .map((row) => ({
              ...row[0]!.deployment_variable,
              values: _.chain(row)
                .groupBy((r) => r.deployment_variable_value?.id)
                .map((r) => ({
                  ...r[0]!.deployment_variable_value!,
                  targets: r.map((r) => r.deployment_variable_value_target!),
                }))
                .value(),
            }))
            .value();
        }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(createDeploymentVariable)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(deploymentVariable).values(input).returning(),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const variable = await ctx.db
          .select()
          .from(deploymentVariable)
          .where(eq(deploymentVariable.id, input.id))
          .then(takeFirst);
        return canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: variable.deploymentId });
      },
    })
    .input(z.object({ id: z.string().uuid(), data: updateDeploymentVariable }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(deploymentVariable)
        .set(input.data)
        .where(eq(deploymentVariable.id, input.id)),
    ),
});
