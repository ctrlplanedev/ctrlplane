import type { MetadataCondition } from "@ctrlplane/validators/conditions";
import { useParams } from "next/navigation";

import type { ReleaseConditionRenderProps } from "./release-condition-props";
import { MetadataConditionRender } from "~/app/[workspaceSlug]/(app)/_components/filter/MetadataConditionRender";
import { api } from "~/trpc/react";

export const ReleaseMetadataConditionRender: React.FC<
  ReleaseConditionRenderProps<MetadataCondition>
> = ({ condition, onChange, className }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
  }>();

  const workspaceQ = api.workspace.bySlug.useQuery(workspaceSlug);
  const workspace = workspaceQ.data;
  const systemQ = api.system.bySlug.useQuery(
    { workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: systemSlug != null },
  );
  const system = systemQ.data;

  const workspaceMetadataKeys =
    api.deployment.version.metadataKeys.byWorkspace.useQuery(
      workspace?.id ?? "",
      { enabled: workspace != null && system == null },
    );
  const systemMetadataKeys =
    api.deployment.version.metadataKeys.bySystem.useQuery(system?.id ?? "", {
      enabled: system != null,
    });

  const metadataKeys =
    systemMetadataKeys.data ?? workspaceMetadataKeys.data ?? [];

  return (
    <MetadataConditionRender
      condition={condition}
      onChange={onChange}
      metadataKeys={metadataKeys}
      className={className}
    />
  );
};
