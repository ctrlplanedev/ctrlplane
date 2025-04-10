import React from "react";
import { useParams } from "next/navigation";

import { IdCondition } from "@ctrlplane/validators/conditions";

import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../../filter/ChoiceConditionRender";
import { EnvironmentConditionRenderProps } from "./environment-condition-props";

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
    const environment = environments.data?.find(
      (environment) => environment.name === value,
    );
    onChange({ ...condition, value: environment?.id ?? "" });
  };

  const selectedEnvironment = environments.data?.find(
    (environment) => environment.id === condition.value,
  );

  const options = (environments.data ?? []).map((environment) => ({
    key: environment.id,
    value: environment.name,
    display: environment.name,
  }));

  const loading = workspace.isLoading || environments.isLoading;

  return (
    <ChoiceConditionRender
      type="environment"
      onSelect={onSelect}
      selected={selectedEnvironment?.name ?? null}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
