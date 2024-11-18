import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import { notFound } from "next/navigation";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import {
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/server";
import { VariableTable } from "./VariableTable";

export default async function VariablesPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();
  const { id: workspaceId } = deployment.system.workspace;
  const variablesByDeployment = await api.deployment.variable.byDeploymentId(
    deployment.id,
  );

  const systemTargetsFilter: ComparisonCondition = {
    type: ResourceFilterType.Comparison,
    operator: ResourceOperator.Or,
    conditions: await api.environment
      .bySystemId(deployment.systemId)
      .then((envs) => envs.map((e) => e.resourceFilter).filter(isPresent)),
  };

  const variablesPromises = variablesByDeployment.map(async (variable) => {
    const defaultValue = variable.values.find(
      (v) => v.id === variable.deploymentVariable.defaultValueId,
    );
    const rest = variable.values.filter((v) => v.id !== defaultValue?.id);

    const valuesPromises = rest.map(async (v) => {
      if (v.resourceFilter == null)
        return {
          ...v,
          targetCount: 0,
          targets: [],
          filterHash: "",
        };

      const filterHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(v.resourceFilter),
      );

      const filter: ComparisonCondition = {
        type: ResourceFilterType.Comparison,
        operator: ResourceOperator.And,
        conditions: [systemTargetsFilter, v.resourceFilter],
      };

      const targets = await api.resource.byWorkspaceId.list({
        workspaceId,
        filter,
        limit: 5,
      });

      return {
        ...v,
        targetCount: targets.total,
        targets: targets.items,
        filterHash,
      };
    });

    const values = await Promise.all(valuesPromises);

    if (defaultValue != null) {
      const restFilters = rest.map((v) => v.resourceFilter).filter(isPresent);

      const filter: ResourceCondition =
        restFilters.length === 0
          ? systemTargetsFilter
          : {
              type: ResourceFilterType.Comparison,
              operator: ResourceOperator.And,
              conditions: [
                systemTargetsFilter,
                {
                  type: ResourceFilterType.Comparison,
                  operator: ResourceOperator.Or,
                  not: true,
                  conditions: restFilters,
                },
              ],
            };

      const defaultTargets = await api.resource.byWorkspaceId.list({
        workspaceId,
        filter,
        limit: 5,
      });

      const filterHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(filter),
      );

      values.unshift({
        ...defaultValue,
        targetCount: defaultTargets.total,
        targets: defaultTargets.items,
        filterHash,
      });
    }

    return {
      ...variable.deploymentVariable,
      values,
    };
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
