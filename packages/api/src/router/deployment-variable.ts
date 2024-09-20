import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createDeploymentVariable,
  createDeploymentVariableValue,
  deployment,
  deploymentVariable,
  deploymentVariableValue,
  deploymentVariableValueTarget,
  deploymentVariableValueTargetFilter,
  system,
  target,
  targetMatchsLabel,
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
    .query(async ({ ctx, input }) => {
      const possibleValuesSubquery = ctx.db
        .select({
          id: deploymentVariableValue.id,
          value: deploymentVariableValue.value,
          variableId: deploymentVariableValue.variableId,
        })
        .from(deploymentVariableValue)
        .as("possible_values_subquery");

      // get all deployment variable value target filters matching the target
      // then get all the deployment variable values + the deployment variable itself
      const deploymentVariables = await ctx.db
        .select()
        .from(target)
        .where(eq(target.id, input))
        .innerJoin(system, eq(target.workspaceId, system.workspaceId))
        .innerJoin(deployment, eq(deployment.systemId, system.id))
        .innerJoin(
          deploymentVariable,
          eq(deploymentVariable.deploymentId, deployment.id),
        )
        .innerJoin(
          possibleValuesSubquery,
          eq(possibleValuesSubquery.variableId, deploymentVariable.id),
        )
        .innerJoin(
          deploymentVariableValue,
          eq(deploymentVariableValue.variableId, deploymentVariable.id),
        )
        .innerJoin(
          deploymentVariableValueTargetFilter,
          eq(
            deploymentVariableValueTargetFilter.variableValueId,
            deploymentVariableValue.id,
          ),
        )
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.deployment_variable.id)
            .map((r) => ({
              ...r[0]!.deployment_variable,
              targetFilter:
                r[0]!.deployment_variable_value_target_filter.targetFilter,
              value: r[0]!.deployment_variable_value,
              possibleValues: r.map((r) => r.possible_values_subquery),
            }))
            .value(),
        );

      const filterMatches = await Promise.all(
        deploymentVariables.map(async (deploymentVariable) => {
          const { targetFilter } = deploymentVariable;

          const tg = await ctx.db
            .select()
            .from(target)
            .where(
              and(
                eq(target.id, input),
                targetMatchsLabel(ctx.db, targetFilter),
              ),
            )
            .then(takeFirstOrNull);

          if (tg == null) return null;

          return {
            ...deploymentVariable,
            value: deploymentVariable.value,
            possibleValues: deploymentVariable.possibleValues,
          };
        }),
      ).then((rows) => rows.filter(isPresent));

      // get all the deployment variable value targets that are direct matches
      // then get all the deployment variable values + the deployment variable itself
      const directMatches = await ctx.db
        .select()
        .from(deploymentVariable)
        .innerJoin(
          possibleValuesSubquery,
          eq(possibleValuesSubquery.variableId, deploymentVariable.id),
        )
        .innerJoin(
          deploymentVariableValue,
          eq(deploymentVariableValue.variableId, deploymentVariable.id),
        )
        .innerJoin(
          deploymentVariableValueTarget,
          eq(
            deploymentVariableValueTarget.variableValueId,
            deploymentVariableValue.id,
          ),
        )
        .where(eq(deploymentVariableValueTarget.targetId, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((row) => row.deployment_variable.id)
            .map((row) => ({
              ...row[0]!.deployment_variable,
              value: row[0]!.deployment_variable_value,
              possibleValues: row.map((r) => r.possible_values_subquery),
            }))
            .value(),
        );

      return [...filterMatches, ...directMatches];
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
