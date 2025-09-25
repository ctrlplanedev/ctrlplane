import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq, getDeploymentVariables } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { resolveVariableValue } from "@ctrlplane/rule-engine";
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

const getVariableValueWithMatchedResources = async (
  db: Tx,
  variableValue: schema.DeploymentVariableValue,
  resources: schema.Resource[],
  isDefault = false,
) => {
  const matchedResourcesPromises = resources.map(async (r) => {
    const resolvedValue = await resolveVariableValue(
      db,
      r.id,
      variableValue,
      isDefault,
      false,
    );
    if (resolvedValue == null) return null;
    const { value, sensitive } = resolvedValue;
    return { ...r, resolvedValue: sensitive ? "***" : value };
  });
  const matchedResources = await Promise.all(matchedResourcesPromises).then(
    (resolved) => resolved.filter(isPresent),
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
  const nonDefaultValues = values.filter(
    (v) => variable.defaultValueId !== v.id,
  );
  const valuesWithResources = await Promise.all(
    nonDefaultValues.map((v) =>
      getVariableValueWithMatchedResources(db, v, resources),
    ),
  );
  const matchedResourceIds = new Set(
    valuesWithResources.flatMap((v) => v.resources.map((r) => r.id)),
  );
  const unmatchedResources = resources.filter(
    (r) => !matchedResourceIds.has(r.id),
  );
  const defaultValueWithResources =
    defaultValue != null
      ? await getVariableValueWithMatchedResources(
          db,
          defaultValue,
          unmatchedResources,
          true,
        )
      : undefined;

  const defaultValueArray =
    defaultValueWithResources != null ? [defaultValueWithResources] : [];
  const valuesWithDefaultAtEnd = [...valuesWithResources, ...defaultValueArray];

  return {
    ...variable,
    values: valuesWithDefaultAtEnd,
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
