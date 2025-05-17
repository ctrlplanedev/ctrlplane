import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, selector } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getReferenceVariableValue } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";

type ResolvedResource = schema.Resource & {
  resolvedValue: string | number | boolean | object | null;
};

const getValueWithMatchedResources = async (
  db: Tx,
  resources: schema.Resource[],
  val: schema.DeploymentVariableValue,
) => {
  if (val.resourceSelector == null)
    return {
      ...val,
      resources: [] as ResolvedResource[],
    };

  const matchedResourcePromises = resources.map(async (r) =>
    db.query.resource.findFirst({
      where: and(
        eq(schema.resource.id, r.id),
        selector().query().resources().where(val.resourceSelector).sql(),
      ),
    }),
  );

  const matchedResources = await Promise.all(matchedResourcePromises).then(
    (resources) => resources.filter(isPresent),
  );

  if (schema.isDeploymentVariableValueReference(val)) {
    const resourcesWithResolvedReferences = await Promise.all(
      matchedResources.map(async (r) => {
        const resolvedValue = await getReferenceVariableValue(r.id, val);
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
};

const getDefaultValueWithRemainingResources = async (
  db: Tx,
  alreadyMatchedResourceIds: string[],
  resources: schema.Resource[],
  val: schema.DeploymentVariableValue,
) => {
  const resourcesMatchedByDefaultPromises = resources
    .filter((r) => !alreadyMatchedResourceIds.includes(r.id))
    .map(async (r) => {
      if (schema.isDeploymentVariableValueReference(val)) {
        const resolvedValue = await getReferenceVariableValue(r.id, val);
        return { ...r, resolvedValue };
      }

      return { ...r, resolvedValue: val.value };
    });

  const resourcesMatchedByDefault = await Promise.all(
    resourcesMatchedByDefaultPromises,
  );

  return { ...val, resources: resourcesMatchedByDefault };
};

export const byDeploymentId = protectedProcedure
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
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.releaseTarget.deploymentId, input));

    const deploymentVariables = await ctx.db.query.deploymentVariable.findMany({
      where: eq(schema.deploymentVariable.deploymentId, input),
      with: { values: true },
    });

    const resolvedVarliablesPromises = deploymentVariables.map(
      async (variable) => {
        const nonDefaultValues = variable.values.filter(
          (v) => v.id !== variable.defaultValueId,
        );

        const nonDefaultValuesWithResources = await Promise.all(
          nonDefaultValues.map(async (val) =>
            getValueWithMatchedResources(
              ctx.db,
              releaseTargets.map((rt) => rt.resource),
              val,
            ),
          ),
        );

        const defaultValue = variable.values.find(
          (v) => v.id === variable.defaultValueId,
        );
        if (defaultValue == null)
          return { ...variable, values: nonDefaultValuesWithResources };

        const matchedResourcesIds = nonDefaultValuesWithResources.flatMap((r) =>
          r.resources.map((r) => r.id),
        );
        const defaultValueWithResources =
          await getDefaultValueWithRemainingResources(
            ctx.db,
            matchedResourcesIds,
            releaseTargets.map((rt) => rt.resource),
            defaultValue,
          );

        return {
          ...variable,
          values: [...nonDefaultValuesWithResources, defaultValueWithResources],
        };
      },
    );

    return Promise.all(resolvedVarliablesPromises);
  });
