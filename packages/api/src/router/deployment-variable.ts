import type { Resource } from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  isNull,
  selector,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createDeploymentVariable,
  createDeploymentVariableValue,
  deployment,
  deploymentVariable,
  deploymentVariableValue,
  isDeploymentVariableValueReference,
  releaseTarget,
  resource,
  resourceMatchesMetadata,
  system,
  updateDeploymentVariable,
  updateDeploymentVariableValue,
} from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { getReferenceVariableValue } from "@ctrlplane/rule-engine";
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
    .input(
      z.object({
        variableId: z.string().uuid(),
        data: createDeploymentVariableValue,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction((tx) =>
        tx
          .insert(deploymentVariableValue)
          .values({
            ...input.data,
            variableId: input.variableId,
          })
          .returning()
          .then(takeFirst)
          .then(async (value) => {
            if (input.data.default)
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
      const releaseTargets = await ctx.db
        .select()
        .from(releaseTarget)
        .innerJoin(resource, eq(releaseTarget.resourceId, resource.id))
        .where(eq(releaseTarget.deploymentId, input));

      const deploymentVariables =
        await ctx.db.query.deploymentVariable.findMany({
          where: eq(deploymentVariable.deploymentId, input),
          with: { values: true },
        });

      const resolvedVarliablesPromises = deploymentVariables.map(
        async (variable) => {
          const nonDefaultValues = variable.values.filter(
            (v) => v.id !== variable.defaultValueId,
          );

          type ResolvedResource = Resource & {
            resolvedValue: string | number | boolean | object | null;
          };

          const nonDefaultValuesWithResources = await Promise.all(
            nonDefaultValues.map(async (val) => {
              if (val.resourceSelector == null)
                return {
                  ...val,
                  resources: [] as ResolvedResource[],
                };

              const matchedResourcePromises = releaseTargets.map(async (rt) =>
                ctx.db.query.resource.findFirst({
                  where: and(
                    eq(resource.id, rt.resource.id),
                    selector()
                      .query()
                      .resources()
                      .where(val.resourceSelector)
                      .sql(),
                  ),
                }),
              );

              const matchedResources = await Promise.all(
                matchedResourcePromises,
              ).then((resources) => resources.filter(isPresent));

              if (isDeploymentVariableValueReference(val)) {
                const resourcesWithResolvedReferences = await Promise.all(
                  matchedResources.map(async (r) => {
                    const resolvedValue = await getReferenceVariableValue(
                      r.id,
                      val,
                    );
                    return { ...r, resolvedValue };
                  }),
                );

                return { ...val, resources: resourcesWithResolvedReferences };
              }

              const resourcesWithDirectValues = matchedResources.map((r) => ({
                ...r,
                resolvedValue: val.value,
              }));
              return { ...val, resources: resourcesWithDirectValues };
            }),
          );

          const defaultValue = variable.values.find(
            (v) => v.id === variable.defaultValueId,
          );
          if (defaultValue == null)
            return { ...variable, values: nonDefaultValuesWithResources };

          const matchedResourcesIds = nonDefaultValuesWithResources.flatMap(
            (r) => r.resources.map((r) => r.id),
          );
          const resourcesMatchedByDefaultPromises = releaseTargets
            .filter((rt) => !matchedResourcesIds.includes(rt.resource.id))
            .map(async (rt) => {
              if (isDeploymentVariableValueReference(defaultValue)) {
                const resolvedValue = await getReferenceVariableValue(
                  rt.resource.id,
                  defaultValue,
                );
                return { ...rt.resource, resolvedValue };
              }

              return { ...rt.resource, resolvedValue: defaultValue.value };
            });

          const resourcesMatchedByDefault = await Promise.all(
            resourcesMatchedByDefaultPromises,
          );
          const defaultValueWithResources = {
            ...defaultValue,
            resources: resourcesMatchedByDefault,
          };

          return {
            ...variable,
            values: [
              ...nonDefaultValuesWithResources,
              defaultValueWithResources,
            ],
          };
        },
      );

      return Promise.all(resolvedVarliablesPromises);
    }),

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
      const variable = await ctx.db
        .insert(deploymentVariable)
        .values({ ...input.data, deploymentId: input.deploymentId })
        .returning()
        .then(takeFirst);

      if (input.data.config?.default) {
        const value = await ctx.db
          .insert(deploymentVariableValue)
          .values({
            variableId: variable.id,
            value: input.data.config.default,
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
