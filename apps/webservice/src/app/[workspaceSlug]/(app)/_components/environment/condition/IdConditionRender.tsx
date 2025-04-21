import type { IdCondition } from "@ctrlplane/validators/conditions";
import React from "react";
import { useParams } from "next/navigation";

import type { EnvironmentConditionRenderProps } from "./environment-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../../filter/ChoiceConditionRender";

export const IdConditionRender: React.FC<
  EnvironmentConditionRenderProps<IdCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const environments = api.environment.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data != null },
  );

  const onSelect = (value: string) => {
    const [, , environmentId] = value.split("/");
    if (environmentId == null) return;

    const environment = environments.data?.find(
      (environment) => environment.id === environmentId,
    );
    onChange({ ...condition, value: environment?.id ?? "" });
  };

  const selectedEnvironment = environments.data?.find(
    (environment) => environment.id === condition.value,
  );

  const options = (environments.data ?? []).map((environment) => ({
    key: environment.id,
    value: `${environment.system.name}/${environment.name}/${environment.id}`,
    display: `${environment.system.name}/${environment.name}`,
  }));

  const loading = workspace.isLoading || environments.isLoading;

  const selectedDisplay =
    selectedEnvironment != null
      ? `${selectedEnvironment.system.name}/${selectedEnvironment.name}`
      : null;

  return (
    <ChoiceConditionRender
      type="environment"
      onSelect={onSelect}
      selected={selectedDisplay}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
