import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  and,
  eq,
  getDeploymentVariables,
  inArray,
  selector,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";

const getReleaseTargets = async (db: Tx, deploymentId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.releaseTarget.deploymentId, deploymentId));

type ValueWithResource = schema.DeploymentVariableValue & {
  resources: schema.Resource[];
};

const getValueWithMatchedResources = async (
  db: Tx,
  variableValue: schema.DeploymentVariableValue,
  resourceIds: Set<string>,
): Promise<ValueWithResource> => {
  const { resourceSelector } = variableValue;
  if (resourceSelector == null) return { ...variableValue, resources: [] };

  const matchedResources = await db
    .select()
    .from(schema.resource)
    .where(
      and(
        inArray(schema.resource.id, Array.from(resourceIds)),
        selector().query().resources().where(resourceSelector).sql(),
      ),
    );

  return { ...variableValue, resources: matchedResources };
};

type Variable = Awaited<ReturnType<typeof getDeploymentVariables>>[number];

const getVariableWithMatchedResources = async (
  db: Tx,
  variable: Variable,
  resources: schema.Resource[],
) => {
  const { values, defaultValue } = variable;
  const nonDefaultValues = values
    .filter((v) => variable.defaultValueId !== v.id)
    .sort((a, b) => a.priority - b.priority);

  const unmatchedResourceIds = new Set(resources.map((r) => r.id));
  const valuesWithResources: ValueWithResource[] = [];

  for (const value of nonDefaultValues) {
    const valueWithResources = await getValueWithMatchedResources(
      db,
      value,
      unmatchedResourceIds,
    );
    valuesWithResources.push(valueWithResources);
    for (const resource of valueWithResources.resources)
      unmatchedResourceIds.delete(resource.id);
  }

  const defaultValueWithResources =
    defaultValue != null
      ? {
          ...defaultValue,
          resources: resources.filter((r) => unmatchedResourceIds.has(r.id)),
        }
      : undefined;
  if (defaultValueWithResources != null)
    valuesWithResources.unshift(defaultValueWithResources);

  return {
    ...variable,
    values: valuesWithResources,
    defaultValue: defaultValueWithResources,
  };
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
    const releaseTargets = await getReleaseTargets(ctx.db, input);
    const resources = releaseTargets.map((rt) => rt.resource);

    const deploymentVariables = await getDeploymentVariables(ctx.db, input);
    const resolvedVariables = await Promise.all(
      deploymentVariables.map((v) =>
        getVariableWithMatchedResources(ctx.db, v, resources),
      ),
    );

    return resolvedVariables;
  });
