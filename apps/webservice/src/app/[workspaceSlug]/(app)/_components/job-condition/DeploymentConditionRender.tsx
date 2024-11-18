import type { DeploymentCondition } from "@ctrlplane/validators/jobs";
import type React from "react";
import { useParams } from "next/navigation";

import type { JobConditionRenderProps } from "./job-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../filter/ChoiceConditionRender";

export const DeploymentConditionRender: React.FC<
  JobConditionRenderProps<DeploymentCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
  }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const workspaceDeploymentsQ = api.deployment.byWorkspaceId.useQuery(
    workspace?.id ?? "",
    { enabled: workspace != null },
  );
  const workspaceDeployments = workspaceDeploymentsQ.data;

  const isEnabled =
    workspace != null && systemSlug != null && deploymentSlug != null;

  const deploymentQ = api.deployment.bySlug.useQuery(
    {
      workspaceSlug: workspaceSlug,
      systemSlug: systemSlug ?? "",
      deploymentSlug: deploymentSlug ?? "",
    },
    { enabled: isEnabled },
  );
  const deployment = deploymentQ.data;

  const deployments =
    deployment != null ? [deployment] : (workspaceDeployments ?? []);

  const options = deployments.map((deployment) => ({
    key: deployment.id,
    value: deployment.id,
    display: deployment.name,
  }));

  const setDeployment = (deploymentId: string) =>
    onChange({ ...condition, value: deploymentId });

  const selectedDeployment = deployments.find(
    (deployment) => deployment.id === condition.value,
  );

  const loading =
    workspaceQ.isLoading ||
    workspaceDeploymentsQ.isLoading ||
    deploymentQ.isLoading;

  return (
    <ChoiceConditionRender
      type="deployment"
      onSelect={setDeployment}
      selected={selectedDeployment?.name ?? null}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
