import type { MetadataCondition } from "@ctrlplane/validators/conditions";
import { useParams } from "next/navigation";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { api } from "~/trpc/react";
import { MetadataConditionRender } from "../filter/MetadataConditionRender";

export const TargetMetadataConditionRender: React.FC<
  TargetConditionRenderProps<MetadataCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const metadataKeys = api.target.metadataKeys.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data != null },
  );

  return (
    <MetadataConditionRender
      condition={condition}
      onChange={onChange}
      metadataKeys={metadataKeys.data ?? []}
      className={className}
    />
  );
};
