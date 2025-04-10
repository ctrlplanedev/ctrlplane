import React from "react";
import { useParams } from "next/navigation";

import { IdCondition } from "@ctrlplane/validators/conditions";

import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../../filter/ChoiceConditionRender";
import { DeploymentConditionRenderProps } from "./deployment-condition-props";

export const IdConditionRender: React.FC<
  DeploymentConditionRenderProps<IdCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const deployments = api.deployment.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data != null },
  );

  const onSelect = (value: string) => {
    const deployment = deployments.data?.find(
      (deployment) => deployment.slug === value,
    );
    onChange({ ...condition, value: deployment?.id ?? "" });
  };

  const selectedDeployment = deployments.data?.find(
    (deployment) => deployment.id === condition.value,
  );

  const options = (deployments.data ?? []).map((deployment) => ({
    key: deployment.id,
    value: deployment.slug,
    display: deployment.slug,
  }));

  const loading = workspace.isLoading || deployments.isLoading;

  return (
    <ChoiceConditionRender
      type="deployment"
      onSelect={onSelect}
      selected={selectedDeployment?.name ?? null}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
