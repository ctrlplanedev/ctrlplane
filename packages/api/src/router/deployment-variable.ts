import type { DeploymentVariableValue } from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  isNotNull,
  isNull,
  ne,
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
  resource,
  resourceMatchesMetadata,
  system,
  updateDeploymentVariable,
  updateDeploymentVariableValue,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingChannelSelectorPolicy,
  isPassingNoPendingJobsPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

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
      const { variable, value } = await ctx.db
        .select()
        .from(deploymentVariableValue)
        .innerJoin(
          deploymentVariable,
          eq(deploymentVariableValue.variableId, deploymentVariable.id),
        )
        .where(eq(deploymentVariableValue.id, input.id))
        .then(takeFirst)
        .then((v) => ({
          variable: v.deployment_variable,
          value: v.deployment_variable_value,
        }));
      const { deploymentId } = variable;
      const dep = await ctx.db.query.deployment
        .findFirst({
          where: eq(deployment.id, deploymentId),
          with: {
            system: {
              with: {
                environments: { where: isNotNull(environment.resourceFilter) },
              },
            },
          },
        })
        .then((d) => d?.system.environments ?? []);

      const systemCondition: ResourceCondition = {
        type: FilterType.Comparison,
        operator: ComparisonOperator.Or,
        conditions: dep.map((e) => e.resourceFilter).filter(isPresent),
      };

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

      const newDefaultValueId = input.data.default
        ? updatedValue.id
        : variable.defaultValueId;

      const otherValues = await ctx.db
        .select()
        .from(deploymentVariableValue)
        .where(
          and(
            eq(deploymentVariableValue.variableId, updatedValue.variableId),
            ne(deploymentVariableValue.id, updatedValue.id),
          ),
        );

      const getOldResourceFilter = (): ResourceCondition | null => {
        if (value.id !== variable.defaultValueId) return value.resourceFilter;
        const conditions = otherValues
          .map((v) => v.resourceFilter)
          .filter(isPresent);
        return {
          type: FilterType.Comparison,
          operator: ComparisonOperator.Or,
          not: true,
          conditions,
        };
      };

      const getNewResourceFilter = (): ResourceCondition | null => {
        if (updatedValue.id !== newDefaultValueId)
          return updatedValue.resourceFilter;
        const conditions = otherValues
          .map((v) => v.resourceFilter)
          .filter(isPresent);
        return {
          type: FilterType.Comparison,
          operator: ComparisonOperator.Or,
          not: true,
          conditions,
        };
      };

      const oldResourceFilter: ResourceCondition = {
        type: FilterType.Comparison,
        operator: ComparisonOperator.And,
        conditions: [systemCondition, getOldResourceFilter()].filter(isPresent),
      };
      const newResourceFilter: ResourceCondition = {
        type: FilterType.Comparison,
        operator: ComparisonOperator.And,
        conditions: [systemCondition, getNewResourceFilter()].filter(isPresent),
      };

      const oldResources = await ctx.db.query.resource.findMany({
        where: and(
          resourceMatchesMetadata(ctx.db, oldResourceFilter),
          isNull(resource.deletedAt),
        ),
      });

      const newResources = await ctx.db.query.resource.findMany({
        where: and(
          resourceMatchesMetadata(ctx.db, newResourceFilter),
          isNull(resource.deletedAt),
        ),
      });

      const oldResourceIds = new Set(oldResources.map((t) => t.id));
      const newResourceIds = new Set(newResources.map((t) => t.id));

      const addedResources = newResources.filter(
        (t) => !oldResourceIds.has(t.id),
      );
      const removedResources = oldResources.filter(
        (t) => !newResourceIds.has(t.id),
      );
      const stagnantResources = newResources.filter((t) =>
        oldResourceIds.has(t.id),
      );

      const resourcesToTrigger = [
        ...addedResources,
        ...removedResources,
        ...(input.data.value !== null ? stagnantResources : []),
      ];

      if (resourcesToTrigger.length > 0)
        await createReleaseJobTriggers(ctx.db, "variable_changed")
          .causedById(ctx.session.user.id)
          .resources(resourcesToTrigger.map((t) => t.id))
          .deployments([deploymentId])
          .filter(isPassingNoPendingJobsPolicy)
          .filter(isPassingChannelSelectorPolicy)
          .insert()
          .then((triggers) =>
            dispatchReleaseJobTriggers(ctx.db)
              .releaseTriggers(triggers)
              .filter(isPassingAllPolicies)
              .then(cancelOldReleaseJobTriggersOnJobDispatch)
              .dispatch(),
          );
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
      // Note: Due to cascading deletes set up in the schema, this will also delete:
      // - All deploymentVariableValueResource entries for this value
      // - All deploymentVariableValueResourceFilter entries for those resources

      return ctx.db
        .delete(deploymentVariableValue)
        .where(eq(deploymentVariableValue.id, input))
        .returning()
        .then(takeFirstOrNull);
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
              resourceFilter: r[0]!.deployment_variable_value.resourceFilter,
              value: r[0]!.deployment_variable_value,
              deployment: { ...r[0]!.deployment, system: r[0]!.system },
            }))
            .value(),
        );

      return Promise.all(
        deploymentVariables.map(async (deploymentVariable) => {
          const { resourceFilter } = deploymentVariable;

          const tg = await ctx.db
            .select()
            .from(resource)
            .where(
              and(
                eq(resource.id, input),
                isNull(resource.deletedAt),
                resourceMatchesMetadata(ctx.db, resourceFilter),
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
          resourceFilter: deploymentVariableValue.resourceFilter,
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
                    'resourceFilter', ${deploymentVariableValueSubquery.resourceFilter}
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
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(deploymentVariable)
        .set(input.data)
        .where(eq(deploymentVariable.id, input.id)),
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
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(deploymentVariable)
        .where(eq(deploymentVariable.id, input))
        .returning()
        .then(takeFirstOrNull);
    }),
});
