import React from "react";
import { useParams } from "next/navigation";

import { SystemCondition } from "@ctrlplane/validators/conditions";

import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../../filter/ChoiceConditionRender";
import { EnvironmentConditionRenderProps } from "./environment-condition-props";

export const SystemConditionRender: React.FC<
  EnvironmentConditionRenderProps<SystemCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const systems = api.system.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.isSuccess && workspace.data != null },
  );

  const onSelect = (value: string) => {
    const system = systems.data?.items.find((system) => system.slug === value);
    onChange({ ...condition, value: system?.id ?? "" });
  };

  const selectedSystem = systems.data?.items.find(
    (system) => system.id === condition.value,
  );

  const options = (systems.data?.items ?? []).map((system) => ({
    key: system.id,
    value: system.slug,
    display: system.slug,
  }));

  const loading = workspace.isLoading || systems.isLoading;

  return (
    <ChoiceConditionRender
      type="system"
      onSelect={onSelect}
      selected={selectedSystem?.name ?? null}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
