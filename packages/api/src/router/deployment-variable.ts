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
  environment,
  system,
  target,
  updateDeploymentVariable,
  variableDeploymentValueTarget,
  variableDeploymentValueTargetFilter,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const valueRouter = createTRPCRouter({
  byId: protectedProcedure.query(async () => {
    // return ctx.db.value.findMany();
  }),

  create: protectedProcedure
    .input(createDeploymentVariableValue)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(deploymentVariableValue).values(input).returning(),
    ),

  setTarget: protectedProcedure
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
            variableDeploymentValueTarget,
            eq(
              deploymentVariableValue.id,
              variableDeploymentValueTarget.variableValueId,
            ),
          )
          .where(
            and(
              eq(deploymentVariableValue.variableId, input.variableId),
              eq(variableDeploymentValueTarget.targetId, input.targetId),
            ),
          )
          .then(takeFirstOrNull);

        if (vv == null)
          // value is already not set.
          return;

        return ctx.db
          .delete(variableDeploymentValueTarget)
          .where(
            and(
              eq(
                variableDeploymentValueTarget.variableValueId,
                vv.deployment_variable_value.id,
              ),
              eq(variableDeploymentValueTarget.targetId, input.targetId),
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
        .insert(variableDeploymentValueTarget)
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
          variableDeploymentValueTarget,
          eq(
            deploymentVariableValue.id,
            variableDeploymentValueTarget.variableValueId,
          ),
        )
        .leftJoin(
          variableDeploymentValueTargetFilter,
          eq(
            variableDeploymentValueTargetFilter.variableValueId,
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
          variableDeploymentValueTarget,
          eq(
            variableDeploymentValueTarget.variableValueId,
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
    .input(createDeploymentVariable)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(deploymentVariable).values(input).returning(),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateDeploymentVariable }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(deploymentVariable)
        .set(input.data)
        .where(eq(deploymentVariable.id, input.id)),
    ),
});
