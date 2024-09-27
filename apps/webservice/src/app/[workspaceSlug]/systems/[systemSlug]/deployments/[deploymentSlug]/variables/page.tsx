import type * as schema from "@ctrlplane/db/schema";
import type { ComparisonCondition } from "@ctrlplane/validators/targets";
import { notFound } from "next/navigation";
import { isPresent } from "ts-is-present";

import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import type { VariableValue } from "./variable-data";
import { api } from "~/trpc/server";
import { VariableTable } from "./VariableTable";

const getTargetInSystemCondition = async (
  systemId: string,
): Promise<ComparisonCondition> => ({
  type: TargetFilterType.Comparison,
  operator: TargetOperator.Or,
  conditions: await api.environment
    .bySystemId(systemId)
    .then((envs) => envs.map((e) => e.targetFilter).filter(isPresent)),
});

type VariableWithValues = {
  variable: schema.DeploymentVariable;
  values: schema.DeploymentVariableValue[];
};

const getVariableValueWithTargets = async (
  variableValue: schema.DeploymentVariableValue,
  systemCondition: ComparisonCondition,
  workspaceId: string,
) => {
  if (variableValue.targetFilter == null) {
    return {
      ...variableValue,
      targetCount: 0,
      targets: [],
    };
  }

  const targets = await api.target.byWorkspaceId.list({
    workspaceId,
    filter: {
      type: TargetFilterType.Comparison,
      operator: TargetOperator.And,
      conditions: [systemCondition, variableValue.targetFilter],
    },
    limit: 5,
  });

  return {
    ...variableValue,
    targetCount: targets.total,
    targets: targets.items,
  };
};

// const getVariableWithValuesAndTargets = async (
//   variable: VariableWithValues,
// ) => {
//   const defaultValue = variable.values.find(v => v.default)
//   const nonDefaultValues = variable.values.filter(v => !v.default)

// }

export default async function VariablesPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) notFound();
  const targetInSystemCondition = await getTargetInSystemCondition(
    deployment.systemId,
  );
  const { total } = await api.target.byWorkspaceId.list({
    workspaceId: deployment.system.workspaceId,
    filter: targetInSystemCondition,
    limit: 0,
  });

  const variables = await api.deployment.variable.byDeploymentId(deployment.id);
  const variablesWithValuesAndTargets = await Promise.all(
    variables.map(async (variable) => {
      const defaultValue = variable.values.find((v) => v.default);
      const nonDefaultValues = variable.values.filter((v) => !v.default);

      const nonDefaultValuesWithTarget = await Promise.all(
        nonDefaultValues.map((v) =>
          getVariableValueWithTargets(
            v,
            targetInSystemCondition,
            deployment.system.workspaceId,
          ),
        ),
      );

      if (defaultValue != null) {
        const defaultValueWithTargets 
      }
    }),
  );

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
