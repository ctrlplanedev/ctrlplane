import type { KindCondition } from "@ctrlplane/validators/resources";
import { useParams } from "next/navigation";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../filter/ChoiceConditionRender";

export const KindConditionRender: React.FC<
  TargetConditionRenderProps<KindCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const kinds = api.workspace.resourceKinds.useQuery(workspace.data?.id ?? "", {
    enabled: workspace.isSuccess && workspace.data != null,
  });

  const setKind = (kind: string) => onChange({ ...condition, value: kind });

  const options = (kinds.data ?? []).map(({ kind }) => ({
    key: kind,
    value: kind,
    display: kind,
  }));

  const loading = workspace.isLoading || kinds.isLoading;

  return (
    <ChoiceConditionRender
      type="kind"
      onSelect={setKind}
      selected={condition.value}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
