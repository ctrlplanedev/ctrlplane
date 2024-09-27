import type { DeploymentVariableValue, Target } from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, asc, eq, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createDeploymentVariable,
  createDeploymentVariableValue,
  deployment,
  deploymentVariable,
  deploymentVariableValue,
  system,
  target,
  targetMatchesMetadata,
  updateDeploymentVariable,
  updateDeploymentVariableValue,
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
          .perform(Permission.DeploymentVariableCreate)
          .on({ type: "deployment", id: variable.deploymentId });
      },
    })
    .input(createDeploymentVariableValue)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(deploymentVariableValue).values(input).returning(),
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
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(deploymentVariableValue)
        .set(input.data)
        .where(eq(deploymentVariableValue.id, input.id)),
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
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.deployment_variable.id)
            .map((r) => ({
              ...r[0]!.deployment_variable,
              targetFilter: r[0]!.deployment_variable_value.targetFilter,
              value: r[0]!.deployment_variable_value,
              possibleValues: r.map((r) => r.possible_values_subquery),
            }))
            .value(),
        );

      return Promise.all(
        deploymentVariables.map(async (deploymentVariable) => {
          const { targetFilter } = deploymentVariable;

          const tg = await ctx.db
            .select()
            .from(target)
            .where(
              and(
                eq(target.id, input),
                targetMatchesMetadata(ctx.db, targetFilter),
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
          targetFilter: deploymentVariableValue.targetFilter,
        })
        .from(deploymentVariableValue)
        .groupBy(deploymentVariableValue.id)
        .as("deployment_variable_value_subquery");

      const deploymentVariables = await ctx.db
        .select({
          deploymentVariable: deploymentVariable,
          values: sql<
            (DeploymentVariableValue & {
              targetFilter: TargetCondition | null;
              targets: Target[];
            })[]
          >`
            coalesce(
              array_agg(
                case when ${deploymentVariableValueSubquery.id} is not null then
                  json_build_object(
                    'id', ${deploymentVariableValueSubquery.id},
                    'value', ${deploymentVariableValueSubquery.value},
                    'variableId', ${deploymentVariableValueSubquery.variableId},
                    'targetFilter', ${deploymentVariableValueSubquery.targetFilter}
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

      return Promise.all(
        deploymentVariables.map(async (deploymentVariable) => ({
          ...deploymentVariable.deploymentVariable,
          values: await Promise.all(
            deploymentVariable.values.map(async (value) => ({
              ...value,
              targets:
                value.targetFilter != null
                  ? await ctx.db
                      .select()
                      .from(target)
                      .where(targetMatchesMetadata(ctx.db, value.targetFilter))
                  : [],
            })),
          ),
        })),
      );
    }),

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
