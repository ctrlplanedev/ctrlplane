import type { VersionCondition } from "@ctrlplane/validators/resources";
import { useParams } from "next/navigation";

import type { ResourceConditionRenderProps } from "./resource-condition-props";
import { api } from "~/trpc/react";
import { ChoiceConditionRender } from "../../filter/ChoiceConditionRender";

export const ResourceVersionConditionRender: React.FC<
  ResourceConditionRenderProps<VersionCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const versions = api.resource.versions.useQuery(workspace.data?.id ?? "", {
    enabled: workspace.isSuccess && workspace.data != null,
  });

  const setVersion = (version: string) =>
    onChange({ ...condition, value: version });

  const selectedVersion = versions.data?.find((v) => v === condition.value);

  const options = (versions.data ?? []).map((version) => ({
    key: version,
    value: version,
    display: version,
  }));

  const loading = workspace.isLoading || versions.isLoading;

  return (
    <ChoiceConditionRender
      type="version"
      onSelect={setVersion}
      selected={selectedVersion ?? null}
      options={options}
      className={className}
      loading={loading}
    />
  );
};
