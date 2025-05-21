import type { MetadataCondition } from "@ctrlplane/validators/conditions";
import { useParams } from "next/navigation";

import type { JobConditionRenderProps } from "./job-condition-props";
import { api } from "~/trpc/react";
import { MetadataConditionRender } from "../../filter/MetadataConditionRender";

export const JobMetadataConditionRender: React.FC<
  JobConditionRenderProps<MetadataCondition>
> = ({ condition, onChange, className }) => {
  const { versionId } = useParams<{ versionId?: string }>();

  const metadataKeysQ = api.job.metadataKey.byVersionId.useQuery(
    versionId ?? "",
    { enabled: versionId != null },
  );
  const metadataKeys = metadataKeysQ.data ?? [];

  return (
    <MetadataConditionRender
      condition={condition}
      onChange={onChange}
      metadataKeys={metadataKeys}
      className={className}
    />
  );
};
