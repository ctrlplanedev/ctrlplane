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

const getVariableValueWithMatchedResources = async (
  db: Tx,
  variableValue: schema.DeploymentVariableValue,
  resources: schema.Resource[],
) => {
  const { resourceSelector } = variableValue;
  if (resourceSelector == null) return { ...variableValue, resources: [] };

  const matchedResources = await db.query.resource.findMany({
    where: and(
      selector().query().resources().where(resourceSelector).sql(),
      inArray(
        schema.resource.id,
        resources.map((r) => r.id),
      ),
    ),
  });

  const resourcesWithResolvedValue = await Promise.all(
    matchedResources.map(async (r) => {
      if (schema.isDeploymentVariableValueDirect(variableValue)) {
        const resolvedValue = variableValue.sensitive
          ? "***"
          : variableValue.value;
        return { ...r, resolvedValue };
      }

      const resolvedReference = await getReferenceVariableValue(
        r.id,
        variableValue,
      );
      return { ...r, resolvedValue: resolvedReference };
    }),
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
    directValues.map((v) =>
      getVariableValueWithMatchedResources(db, v, resources),
    ),
  );
  const referenceValuesWithResources = await Promise.all(
    referenceValues.map((v) =>
      getVariableValueWithMatchedResources(db, v, resources),
    ),
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
      ? { ...variable.defaultValue, resources: unmatchedResources }
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
