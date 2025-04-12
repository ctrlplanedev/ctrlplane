import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import {
  ResourceConditionType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/server";
import { VariableTable } from "./VariableTable";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  return {
    title: `Variables | ${deployment.name} | ${deployment.system.name}`,
    description: `Manage variables for ${deployment.name} deployment`,
  };
}

export default async function VariablesPage(props: {
  params: Promise<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>;
}) {
  const params = await props.params;
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();
  const { id: workspaceId } = deployment.system.workspace;
  const variablesByDeployment = await api.deployment.variable.byDeploymentId(
    deployment.id,
  );

  const systemResourcesCondition: ComparisonCondition = {
    type: ResourceConditionType.Comparison,
    operator: ResourceOperator.Or,
    conditions: await api.environment
      .bySystemId(deployment.systemId)
      .then((envs) => envs.map((e) => e.resourceSelector).filter(isPresent)),
  };

  const variablesPromises = variablesByDeployment.map(async (variable) => {
    const defaultValue = variable.values.find(
      (v) => v.id === variable.deploymentVariable.defaultValueId,
    );
    const rest = variable.values.filter((v) => v.id !== defaultValue?.id);

    const valuesPromises = rest.map(async (v) => {
      if (v.resourceSelector == null)
        return {
          ...v,
          resourceCount: 0,
          resources: [],
          conditionHash: "",
        };

      const conditionHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(v.resourceSelector),
      );

      const condition: ComparisonCondition = {
        type: ResourceConditionType.Comparison,
        operator: ResourceOperator.And,
        conditions: [systemResourcesCondition, v.resourceSelector],
      };

      const resources = await api.resource.byWorkspaceId.list({
        workspaceId,
        filter: condition,
        limit: 5,
      });

      return {
        ...v,
        resourceCount: resources.total,
        resources: resources.items,
        conditionHash,
      };
    });

    const values = await Promise.all(valuesPromises);

    if (defaultValue != null) {
      const restConditions = rest
        .map((v) => v.resourceSelector)
        .filter(isPresent);

      const filter: ResourceCondition =
        restConditions.length === 0
          ? systemResourcesCondition
          : {
              type: ResourceConditionType.Comparison,
              operator: ResourceOperator.And,
              conditions: [
                systemResourcesCondition,
                {
                  type: ResourceConditionType.Comparison,
                  operator: ResourceOperator.Or,
                  not: true,
                  conditions: restConditions,
                },
              ],
            };

      const defaultResources = await api.resource.byWorkspaceId.list({
        workspaceId,
        filter,
        limit: 5,
      });

      const conditionHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(filter),
      );

      values.unshift({
        ...defaultValue,
        resourceCount: defaultResources.total,
        resources: defaultResources.items,
        conditionHash,
      });
    }

    return { ...variable.deploymentVariable, values };
  });

  const variables = await Promise.all(variablesPromises);

  return (
    <div className="h-full overflow-y-auto pb-[100px]">
      <div className="min-h-full">
        <VariableTable variables={variables} />
      </div>
    </div>
  );
}
