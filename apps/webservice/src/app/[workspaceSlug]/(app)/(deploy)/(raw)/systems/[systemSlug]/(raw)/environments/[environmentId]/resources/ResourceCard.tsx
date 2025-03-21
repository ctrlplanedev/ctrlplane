import type * as SCHEMA from "@ctrlplane/db/schema";

import { Badge } from "@ctrlplane/ui/badge";

const statusColor = {
  healthy: "bg-green-500",
  degraded: "bg-amber-500",
  failed: "bg-red-500",
  updating: "bg-blue-500",
  unknown: "bg-neutral-500",
};

type ResourceStatus = keyof typeof statusColor;

export const ResourceCard: React.FC<{
  resource: SCHEMA.Resource;
  resourceStatus?: ResourceStatus;
}> = ({ resource, resourceStatus }) => {
  return (
    <div
      key={resource.id}
      className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${resourceStatus ? statusColor[resourceStatus] : "bg-neutral-500"}`}
          />
          <h3 className="font-medium text-neutral-200">{resource.name}</h3>
        </div>
        <Badge
          variant="outline"
          className="bg-neutral-800/50 text-xs text-neutral-300"
        >
          {resource.kind}
        </Badge>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-neutral-400">Version</div>
        <div className="text-right text-neutral-300">{resource.version}</div>

        <div className="text-neutral-400">Identifier</div>
        <div className="text-right text-neutral-300">{resource.identifier}</div>

        <div className="text-neutral-400">Provider</div>
        <div className="text-right text-neutral-300">{resource.providerId}</div>

        <div className="text-neutral-400">Updated</div>
        <div className="text-right text-neutral-300">
          {resource.updatedAt?.toLocaleDateString() ??
            resource.createdAt.toLocaleDateString()}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-400">Provider</span>
          <span className="text-neutral-300">{resource.providerId}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-400">Deployment Success</span>
          <span
          // className={`text-${resource.healthScore > 90 ? "green" : resource.healthScore > 70 ? "amber" : "red"}-400`}
          >
            10%
          </span>
        </div>

        <div className="mt-2 rounded-md bg-neutral-800/50 px-2 py-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-300">ID: {resource.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
