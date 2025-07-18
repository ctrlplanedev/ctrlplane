import { notFound } from "next/navigation";
import * as yaml from "js-yaml";

import { MetadataInfo } from "~/app/[workspaceSlug]/(app)/_components/MetadataInfo";
import { api } from "~/trpc/server";
import { ResourceProperties } from "../_components/ResourceProperties";
import { ConfigEditor } from "./ConfigEditor";

const ResourceConfigInfo: React.FC<{ config: Record<string, any> }> = ({
  config,
}) => <ConfigEditor value={yaml.dump(config)} readOnly />;

export default async function PropertiesPage(props: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await props.params;
  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  return (
    <div className="container space-y-4 p-8">
      <ResourceProperties resource={resource} />

      <div>
        <div className="mb-2 text-sm">Config</div>
        <div className="text-xs">
          <ResourceConfigInfo config={resource.config} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm">
          Metadata ({Object.keys(resource.metadata).length})
        </div>
        <div className="text-xs">
          <MetadataInfo metadata={resource.metadata} />
        </div>
      </div>
    </div>
  );
}
