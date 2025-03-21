import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconCopy } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { toast } from "@ctrlplane/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

const statusColor = {
  healthy: "bg-green-500",
  degraded: "bg-amber-500",
  failed: "bg-red-500",
  updating: "bg-blue-500",
  unknown: "bg-neutral-500",
};

type ResourceStatus = keyof typeof statusColor;

const PropertyWithTooltip: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate text-right text-neutral-300">{content}</div>
        </TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ResourceCard: React.FC<{
  resource: SCHEMA.Resource;
  resourceStatus?: ResourceStatus;
}> = ({ resource, resourceStatus }) => {
  const handleCopyId = () => {
    navigator.clipboard.writeText(resource.id);
    toast("Resource ID copied", {
      description: resource.id,
      duration: 2000,
    });
  };

  return (
    <div
      key={resource.id}
      className="h-[196px] rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${resourceStatus ? statusColor[resourceStatus] : "bg-neutral-500"} flex-shrink-0`}
          />
          <PropertyWithTooltip content={resource.name} />
        </div>
        <Badge
          variant="outline"
          className="flex-shrink-0 truncate bg-neutral-800/50 text-xs text-neutral-300"
        >
          {resource.kind}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-muted-foreground">ID</div>
        <div className="flex items-center justify-end gap-1">
          <span className="truncate text-neutral-300">
            {resource.id.split("-").at(0)}...
          </span>
          <button
            onClick={handleCopyId}
            className="text-muted-foreground hover:text-neutral-200"
            title="Copy ID"
          >
            <IconCopy size={14} />
          </button>
        </div>

        <div className="truncate text-muted-foreground">Version</div>
        <PropertyWithTooltip content={resource.version} />

        <div className="truncate text-muted-foreground">Identifier</div>
        <PropertyWithTooltip content={resource.identifier} />

        <div className="truncate text-muted-foreground">Provider</div>
        <PropertyWithTooltip content={resource.providerId ?? ""} />

        <div className="truncate text-muted-foreground">Updated</div>
        <div className="truncate text-right text-neutral-300">
          {resource.updatedAt?.toLocaleDateString() ??
            resource.createdAt.toLocaleDateString()}
        </div>

        <div className="truncate text-muted-foreground">Deployment Success</div>
        <div className="truncate text-right text-neutral-300">10%</div>
      </div>
    </div>
  );
};
