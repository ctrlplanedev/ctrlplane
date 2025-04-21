import type { IdCondition } from "@ctrlplane/validators/conditions";
import React from "react";
import { useParams } from "next/navigation";

import type { DeploymentConditionRenderProps } from "./deployment-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../../filter/ChoiceConditionRender";

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
    const [, , deploymentId] = value.split("/");
    if (deploymentId == null) return;

    const deployment = deployments.data?.find(
      (deployment) => deployment.id === deploymentId,
    );
    onChange({ ...condition, value: deployment?.id ?? "" });
  };

  const selectedDeployment = deployments.data?.find(
    (deployment) => deployment.id === condition.value,
  );

  const options = (deployments.data ?? []).map((deployment) => ({
    key: deployment.id,
    value: `${deployment.system.name}/${deployment.name}/${deployment.id}`,
    display: `${deployment.system.name}/${deployment.name}`,
  }));

  const loading = workspace.isLoading || deployments.isLoading;

  const selectedDisplay =
    selectedDeployment != null
      ? `${selectedDeployment.system.name}/${selectedDeployment.name}`
      : null;

  return (
    <ChoiceConditionRender
      type="deployment"
      onSelect={onSelect}
      selected={selectedDisplay}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
