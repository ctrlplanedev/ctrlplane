import type { Deployment } from "@ctrlplane/db/schema";
import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import React from "react";
import { notFound } from "next/navigation";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import { Card } from "@ctrlplane/ui/card";
import {
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/server";
import { EditDeploymentSection } from "./EditDeploymentSection";
import { JobAgentSection } from "./JobAgentSection";
import { SidebarSection } from "./SettingsSidebar";
import { VariableTable } from "./variables/VariableTable";

const Variables: React.FC<{
  deployment: Deployment;
  workspaceId: string;
}> = async ({ deployment, workspaceId }) => {
  const variablesByDeployment = await api.deployment.variable.byDeploymentId(
    deployment.id,
  );

  const systemResourcesFilter: ComparisonCondition = {
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
          resourceCount: 0,
          resources: [],
          filterHash: "",
        };

      const filterHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(v.resourceFilter),
      );

      const filter: ComparisonCondition = {
        type: ResourceFilterType.Comparison,
        operator: ResourceOperator.And,
        conditions: [systemResourcesFilter, v.resourceFilter],
      };

      const resources = await api.resource.byWorkspaceId.list({
        workspaceId,
        filter,
        limit: 5,
      });

      return {
        ...v,
        resourceCount: resources.total,
        resources: resources.items,
        filterHash,
      };
    });

    const values = await Promise.all(valuesPromises);

    if (defaultValue != null) {
      const restFilters = rest.map((v) => v.resourceFilter).filter(isPresent);

      const filter: ResourceCondition =
        restFilters.length === 0
          ? systemResourcesFilter
          : {
              type: ResourceFilterType.Comparison,
              operator: ResourceOperator.And,
              conditions: [
                systemResourcesFilter,
                {
                  type: ResourceFilterType.Comparison,
                  operator: ResourceOperator.Or,
                  not: true,
                  conditions: restFilters,
                },
              ],
            };

      const defaultResources = await api.resource.byWorkspaceId.list({
        workspaceId,
        filter,
        limit: 5,
      });

      const filterHash = LZString.compressToEncodedURIComponent(
        JSON.stringify(filter),
      );

      values.unshift({
        ...defaultValue,
        resourceCount: defaultResources.total,
        resources: defaultResources.items,
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
    <div className="container m-8 mx-auto max-w-3xl space-y-2">
      <div>
        <h2 id="variables">Variables</h2>
        <div className="text-xs text-muted-foreground">
          Deployment variables allow you to configure resource-specific settings
          for your application. Learn more about variable precedence here.
        </div>
      </div>

      <Card className="pb-2">
        <VariableTable variables={variables} />
      </Card>
    </div>
  );
};

export default async function DeploymentPage(
  props: {
    params: Promise<{ workspaceSlug: string; systemSlug: string; deploymentSlug: string }>;
  }
) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const workspaceId = workspace.id;
  const { items: systems } = await api.system.list({ workspaceId });
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const jobAgents = await api.job.agent.byWorkspaceId(workspaceId);
  const jobAgent = jobAgents.find((a) => a.id === deployment.jobAgentId);

  return (
    <div className="container mx-auto flex max-w-5xl gap-12">
      <div className="sticky top-8 my-8 h-full w-[150px] flex-shrink-0">
        <div>
          <SidebarSection id="properties">Properties</SidebarSection>
          <SidebarSection id="job-agent">Job Agent</SidebarSection>
          <SidebarSection id="variables">Variables</SidebarSection>
        </div>
      </div>
      <div className="mb-16 flex-grow space-y-10">
        <EditDeploymentSection
          deployment={deployment}
          systems={systems}
          workspaceId={workspaceId}
        />

        <JobAgentSection
          jobAgents={jobAgents}
          workspace={workspace}
          jobAgent={jobAgent}
          jobAgentConfig={deployment.jobAgentConfig}
          deploymentId={deployment.id}
        />

        <Variables workspaceId={workspaceId} deployment={deployment} />
      </div>
    </div>
  );
}
