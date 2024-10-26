import type { ProviderCondition } from "@ctrlplane/validators/targets";
import { useParams } from "next/navigation";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../filter/ChoiceConditionRender";

export const ProviderConditionRender: React.FC<
  TargetConditionRenderProps<ProviderCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const providers = api.target.provider.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data != null },
  );

  const setProvider = (provider: string) =>
    onChange({ ...condition, value: provider });

  const selectedProvider = providers.data?.find(
    (provider) => provider.id === condition.value,
  );

  const options = (providers.data ?? []).map((provider) => ({
    key: provider.id,
    value: provider.id,
    display: provider.name,
  }));

  const loading = workspace.isLoading || providers.isLoading;

  return (
    <ChoiceConditionRender
      type="provider"
      onSelect={setProvider}
      selected={selectedProvider?.name ?? null}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
