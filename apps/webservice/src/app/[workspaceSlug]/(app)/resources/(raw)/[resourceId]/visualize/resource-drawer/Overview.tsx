import * as yaml from "js-yaml";

import type { ResourceInformation } from "../types";
import { MetadataInfo } from "~/app/[workspaceSlug]/(app)/_components/MetadataInfo";
import { ResourceProperties } from "../../_components/ResourceProperties";
import { ConfigEditor } from "../../properties/ConfigEditor";

const ResourceConfigInfo: React.FC<{ config: Record<string, any> }> = ({
  config,
}) => <ConfigEditor value={yaml.dump(config)} readOnly />;

export const ResourceDrawerOverview: React.FC<{
  resource: ResourceInformation;
}> = ({ resource }) => {
  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-123px)] space-y-4 overflow-x-auto overflow-y-scroll p-6">
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
};
