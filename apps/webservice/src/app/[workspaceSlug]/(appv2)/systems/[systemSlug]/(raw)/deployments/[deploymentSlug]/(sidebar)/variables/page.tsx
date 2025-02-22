import type {
  ComparisonCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";
import {
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { api } from "~/trpc/server";
import { CreateVariableDialog } from "./CreateVariableDialog";
import { VariableTable } from "./VariableTable";

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

    return { ...variable.deploymentVariable, values };
  });

  const variables = await Promise.all(variablesPromises);

  return (
    <div>
      <PageHeader className="justify-between">
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments`}
          >
            <IconArrowLeft className="size-5" />
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Variables</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <CreateVariableDialog deploymentId={deployment.id}>
          <Button variant="outline" size="sm">
            Create Variable
          </Button>
        </CreateVariableDialog>
      </PageHeader>
      <div className="h-full overflow-y-auto pb-[100px]">
        <div className="min-h-full">
          <VariableTable variables={variables} />
        </div>
      </div>
    </div>
  );
}
