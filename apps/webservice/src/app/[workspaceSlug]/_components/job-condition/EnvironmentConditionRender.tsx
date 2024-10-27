import type { EnvironmentCondition } from "@ctrlplane/validators/jobs";
import { useParams } from "next/navigation";

import type { JobConditionRenderProps } from "./job-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../filter/ChoiceConditionRender";

export const EnvironmentConditionRender: React.FC<
  JobConditionRenderProps<EnvironmentCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
  }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;

  const systemQ = api.system.bySlug.useQuery(
    { workspaceSlug: workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: workspace != null && systemSlug != null },
  );
  const system = systemQ.data;

  const workspaceEnvironmentsQ = api.environment.byWorkspaceId.useQuery(
    workspace?.id ?? "",
    { enabled: workspace != null },
  );
  const workspaceEnvironments = workspaceEnvironmentsQ.data;

  const systemEnvironmentsQ = api.environment.bySystemId.useQuery(
    system?.id ?? "",
    { enabled: system != null },
  );
  const systemEnvironments = systemEnvironmentsQ.data;

  const environments = systemEnvironments ?? workspaceEnvironments ?? [];

  const loading =
    workspaceQ.isLoading ||
    systemQ.isLoading ||
    workspaceEnvironmentsQ.isLoading ||
    systemEnvironmentsQ.isLoading;

  const options = environments.map((environment) => ({
    key: environment.id,
    value: environment.id,
    display: `${environment.name} (${environment.system.name})`,
  }));

  const setEnvironment = (environment: string) =>
    onChange({ ...condition, value: environment });

  const selectedEnvironment = environments.find(
    (environment) => environment.id === condition.value,
  );

  const selectedDisplay = selectedEnvironment
    ? `${selectedEnvironment.name} (${selectedEnvironment.system.name})`
    : null;

  return (
    <ChoiceConditionRender
      type="environment"
      onSelect={setEnvironment}
      selected={selectedDisplay}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
