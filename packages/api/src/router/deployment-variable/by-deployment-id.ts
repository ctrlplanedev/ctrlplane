import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { z } from "zod";

import {
  and,
  eq,
  getDeploymentVariables,
  inArray,
  selector,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getReferenceVariableValue } from "@ctrlplane/rule-engine";
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

const getMatchedResources = async (
  db: Tx,
  resourceSelector: ResourceCondition | null,
  resourceIds: string[],
) =>
  resourceSelector == null || resourceIds.length === 0
    ? []
    : db.query.resource.findMany({
        where: and(
          selector().query().resources().where(resourceSelector).sql(),
          inArray(schema.resource.id, resourceIds),
        ),
      });

const resolveValueForResource = async (
  db: Tx,
  resource: schema.Resource,
  variableValue: schema.DeploymentVariableValue,
) => {
  if (schema.isDeploymentVariableValueDirect(variableValue)) {
    const resolvedValue = variableValue.sensitive ? "***" : variableValue.value;
    return { ...resource, resolvedValue };
  }

  const resolvedReference = await getReferenceVariableValue(
    resource.id,
    variableValue,
  );
  return { ...resource, resolvedValue: resolvedReference };
};

const getVariableValueWithMatchedResources = async (
  db: Tx,
  variableValue: schema.DeploymentVariableValue,
  resources: schema.Resource[],
) => {
  const matchedResources = await getMatchedResources(
    db,
    variableValue.resourceSelector,
    resources.map((r) => r.id),
  );

  const resourcesWithResolvedValue = await Promise.all(
    matchedResources.map((r) => resolveValueForResource(db, r, variableValue)),
  );

  return { ...variableValue, resources: resourcesWithResolvedValue };
};

const getDefaultValueWithMatchedResources = async (
  db: Tx,
  variableValue: schema.DeploymentVariableValue,
  resources: schema.Resource[],
) => {
  const resourcesWithResolvedValue = await Promise.all(
    resources.map((r) => resolveValueForResource(db, r, variableValue)),
  );

  return { ...variableValue, resources: resourcesWithResolvedValue };
};

type Variable = Awaited<ReturnType<typeof getDeploymentVariables>>[number];

const getVariableWithMatchedResources = async (
  db: Tx,
  variable: Variable,
  resources: schema.Resource[],
) => {
  const { directValues, referenceValues } = variable;
  const directValuesWithResources = await Promise.all(
    directValues
      .filter((v) => v.id !== variable.defaultValue?.id)
      .map((v) => getVariableValueWithMatchedResources(db, v, resources)),
  );
  const referenceValuesWithResources = await Promise.all(
    referenceValues
      .filter((v) => v.id !== variable.defaultValue?.id)
      .map((v) => getVariableValueWithMatchedResources(db, v, resources)),
  );

  const matchedResourceIds = new Set([
    ...directValuesWithResources.flatMap((v) => v.resources.map((r) => r.id)),
    ...referenceValuesWithResources.flatMap((v) =>
      v.resources.map((r) => r.id),
    ),
  ]);

  const unmatchedResources = resources.filter(
    (r) => !matchedResourceIds.has(r.id),
  );

  const defaultValue =
    variable.defaultValue != null
      ? await getDefaultValueWithMatchedResources(
          db,
          variable.defaultValue,
          unmatchedResources,
        )
      : undefined;

  return {
    ...variable,
    directValues: directValuesWithResources,
    referenceValues: referenceValuesWithResources,
    defaultValue,
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
