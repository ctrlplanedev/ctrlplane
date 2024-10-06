import type { Deployment } from "@ctrlplane/db/schema";
import type {
  ComparisonCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import React from "react";
import { notFound } from "next/navigation";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import { Card } from "@ctrlplane/ui/card";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { api } from "~/trpc/server";
import { JobAgentSection } from "./JobAgentSection";
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
    <div className="container m-8 mx-auto max-w-5xl space-y-2">
      <div>
        <h2 className="">Variables</h2>
        <div className="text-xs text-muted-foreground">
          Deployment variables allow you to configure target-specific settings
          for your application. Learn more about variable precedence here.
        </div>
      </div>

      <Card className="pb-2">
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
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);
  const jobAgent = jobAgents.find((a) => a.id === deployment.jobAgentId);

  return (
    <>
      <div className="container m-8 mx-auto max-w-5xl space-y-2">
        <div>
          <h2 className="">Properties</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <table
              width="100%"
              className="text-xs"
              style={{ tableLayout: "fixed" }}
            >
              <tbody>
                <tr>
                  <td className="w-[110px] p-1 pr-2 text-muted-foreground">
                    ID
                  </td>
                  <td>{deployment.id}</td>
                </tr>

                <tr>
                  <td className="w-[110px] p-1 pr-2 text-muted-foreground">
                    Name
                  </td>
                  <td>{deployment.name}</td>
                </tr>

                <tr>
                  <td className="w-[110px] p-1 pr-2 text-muted-foreground">
                    Slug
                  </td>
                  <td>{deployment.slug}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <JobAgentSection
        jobAgents={jobAgents}
        workspace={workspace}
        jobAgent={jobAgent}
        config={deployment.jobAgentConfig}
      />

      <Variables workspaceId={workspace.id} deployment={deployment} />
    </>
  );
}
