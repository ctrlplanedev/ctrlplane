import type { Deployment } from "@ctrlplane/db/schema";
import type {
  ComparisonCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import React from "react";
import { notFound } from "next/navigation";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { api } from "~/trpc/server";
import { VariableTable } from "./variables/VariableTable";

const Variables: React.FC<{
  deployment: Deployment;
  workspaceId: string;
}> = async ({ deployment, workspaceId }) => {
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
          filterHash: "",
        };

      const filterHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(v.targetFilter),
      );

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
        filterHash,
      };
    });

    const values = await Promise.all(valuesPromises);

    if (defaultValue != null) {
      const restFilters = rest.map((v) => v.targetFilter).filter(isPresent);

      const filter: TargetCondition =
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
            };

      const defaultTargets = await api.target.byWorkspaceId.list({
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
    <div className="container m-8 mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="">Variables</h2>
      </div>
      <Card>
        <VariableTable variables={variables} />
      </Card>
    </div>
  );
};

export default async function DeploymentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  const releases = await api.release.list({
    deploymentId: deployment.id,
    limit: 0,
  });

  return (
    <>
      <CardHeader className="space-y-0 border-b p-0">
        <div className="container mx-auto flex max-w-5xl flex-col items-stretch sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 py-5 sm:py-6">
            <CardTitle>{deployment.name}</CardTitle>
            <CardDescription>
              {deployment.description !== "" ? (
                deployment.description
              ) : (
                <span className="italic">Add description ...</span>
              )}
            </CardDescription>
          </div>
          <div className="flex">
            <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
              <span className="text-xs text-muted-foreground">Releases</span>
              <span className="text-lg font-bold leading-none sm:text-3xl">
                {releases.total}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="container m-8 mx-auto max-w-5xl">
        <div>
          <h2 className="">Releases</h2>
        </div>
      </div>

      <Variables workspaceId={workspace.id} deployment={deployment} />
    </>
  );
}
