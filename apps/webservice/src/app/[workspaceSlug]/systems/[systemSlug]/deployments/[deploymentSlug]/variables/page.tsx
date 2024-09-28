import type { ComparisonCondition } from "@ctrlplane/validators/targets";
import { notFound } from "next/navigation";
import { isPresent } from "ts-is-present";

import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

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
    type: TargetFilterType.Comparison,
    operator: TargetOperator.Or,
    conditions: await api.environment
      .bySystemId(deployment.systemId)
      .then((envs) => envs.map((e) => e.targetFilter).filter(isPresent)),
  };

  const variablesPromises = variablesByDeployment.map(async (variable) => {
    const defaultValue = variable.values.find(
      (v) => v.id === variable.deploymentVariable.defaultValueId,
    );
    const rest = variable.values.filter((v) => v.id !== defaultValue?.id);

    const valuesPromises = rest.map(async (v) => {
      if (v.targetFilter == null)
        return {
          ...v,
          targetCount: 0,
          targets: [],
        };

      const filter: ComparisonCondition = {
        type: TargetFilterType.Comparison,
        operator: TargetOperator.And,
        conditions: [systemTargetsFilter, v.targetFilter],
      };

      const targets = await api.target.byWorkspaceId.list({
        workspaceId,
        filter,
        limit: 5,
      });

      return {
        ...v,
        targetCount: targets.total,
        targets: targets.items,
      };
    });

    const values = await Promise.all(valuesPromises);

    if (defaultValue != null) {
      const restFilters = rest.map((v) => v.targetFilter).filter(isPresent);

      const defaultTargets = await api.target.byWorkspaceId.list({
        workspaceId,
        filter:
          restFilters.length === 0
            ? systemTargetsFilter
            : {
                type: TargetFilterType.Comparison,
                operator: TargetOperator.And,
                conditions: [
                  systemTargetsFilter,
                  {
                    type: TargetFilterType.Comparison,
                    operator: TargetOperator.Or,
                    not: true,
                    conditions: restFilters,
                  },
                ],
              },
        limit: 5,
      });

      values.unshift({
        ...defaultValue,
        targetCount: defaultTargets.total,
        targets: defaultTargets.items,
      });
    }

    return {
      ...variable.deploymentVariable,
      values,
    };
  });

  const variables = await Promise.all(variablesPromises);

  return (
    <>
      <div className="h-full overflow-y-auto pb-[100px]">
        <div className="min-h-full">
          <VariableTable variables={variables} />
        </div>
      </div>
    </>
  );
}
