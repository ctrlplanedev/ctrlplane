import { useState } from "react";
import {
  CheckCircleIcon,
  ChevronDown,
  ChevronRight,
  ClockIcon,
  FileQuestionIcon,
  XCircleIcon,
} from "lucide-react";

import type { DeploymentTraceSpan, TraceTreeNode } from "./trace-utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import {
  calculateSpanDuration,
  formatDuration,
  formatRelativeTime,
} from "./trace-utils";

const StatusIcon: Record<string, { icon: React.ReactNode; label: string }> = {
  completed: {
    icon: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
    label: "Completed",
  },
  denied: {
    icon: <XCircleIcon className="h-4 w-4 text-red-500" />,
    label: "Denied",
  },
  failed: {
    icon: <XCircleIcon className="h-4 w-4 text-red-500" />,
    label: "Failed",
  },
  error: {
    icon: <XCircleIcon className="h-4 w-4 text-red-500" />,
    label: "Error",
  },
  pending: {
    icon: <ClockIcon className="h-4 w-4 text-yellow-500" />,
    label: "Pending",
  },
  running: {
    icon: <ClockIcon className="h-4 w-4 text-yellow-500" />,
    label: "Running",
  },
  unknown: {
    icon: <FileQuestionIcon className="h-4 w-4 text-gray-500" />,
    label: "Unknown",
  },
};

interface TraceTreeProps {
  nodes: TraceTreeNode[];
  onSpanSelect?: (span: DeploymentTraceSpan) => void;
  selectedSpanId?: string;
  level?: number;
}

interface TraceNodeProps {
  node: TraceTreeNode;
  onSpanSelect?: (span: DeploymentTraceSpan) => void;
  selectedSpanId?: string;
  level: number;
}

/**
 * Extract useful display information from span attributes
 */
function getSpanDisplayInfo(node: TraceTreeNode): {
  primaryText: string;
  secondaryText?: string;
  reason?: string;
} {
  const attrs = node.attributes ?? {};

  // Check for common useful attributes
  const name =
    attrs.name ?? attrs.label ?? attrs.resourceName ?? attrs.targetName;
  const type = attrs.type ?? attrs.kind ?? attrs.action;
  const identifier = attrs.id ?? attrs.identifier ?? attrs.key;

  // Extract reason/message information
  const reason =
    attrs.reason ?? attrs.message ?? attrs.error ?? attrs.description;

  // Build descriptive text
  let primaryText = node.name;
  let secondaryText: string | undefined;

  // If the node name is generic or not helpful, use attributes
  if (name && typeof name === "string") {
    primaryText = name;
    if (type && typeof type === "string") {
      secondaryText = type;
    }
  } else if (type && typeof type === "string") {
    secondaryText = type;
  }

  // Add identifier if available and not already in primary text
  if (
    identifier &&
    typeof identifier === "string" &&
    !primaryText.includes(identifier)
  ) {
    secondaryText = secondaryText
      ? `${secondaryText} (${identifier})`
      : identifier;
  }

  return {
    primaryText,
    secondaryText,
    reason: reason && typeof reason === "string" ? reason : undefined,
  };
}

function TraceNode({
  node,
  onSpanSelect,
  selectedSpanId,
  level,
}: TraceNodeProps) {
  // Expand all nodes by default (grouping handles collapsing)
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const duration = calculateSpanDuration(node);
  const isSelected = selectedSpanId === node.spanId;
  const displayInfo = getSpanDisplayInfo(node);

  const groupByName = node.attributes?.["ctrlplane.group_by_name"];

  const statusInfo = StatusIcon[node.status ?? "unknown"];
  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
          isSelected && "bg-accent",
        )}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="h-5 w-5" />
        )}

        <button
          className="flex flex-1 items-center gap-2 text-left"
          onClick={() => onSpanSelect?.(node)}
        >
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 font-medium">
                {groupByName && (
                  <span className="text-xs text-muted-foreground">
                    ({groupByName}){" "}
                  </span>
                )}
                {displayInfo.primaryText}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center">
                        {statusInfo.icon}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{statusInfo.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </div>
            {displayInfo.secondaryText && (
              <span className="text-xs text-muted-foreground">
                {displayInfo.secondaryText}
              </span>
            )}
            {displayInfo.reason && (
              <span className="text-xs italic text-muted-foreground">
                {displayInfo.reason}
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-0.5">
            {level < 2 && (
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(node.startTime)}
              </span>
            )}
            {duration !== null && duration > 1000 && (
              <span className="text-xs text-muted-foreground">
                ({formatDuration(duration)})
              </span>
            )}
          </div>
        </button>
      </div>

      {isExpanded && hasChildren && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <TraceNode
              key={child.spanId}
              node={child}
              onSpanSelect={onSpanSelect}
              selectedSpanId={selectedSpanId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VersionGroupNode({
  versionId,
  nodes,
  onSpanSelect,
  selectedSpanId,
  level,
}: {
  versionId: string;
  nodes: TraceTreeNode[];
  onSpanSelect?: (span: DeploymentTraceSpan) => void;
  selectedSpanId?: string;
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full">
      <div
        className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm transition-colors hover:bg-muted"
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        <span className="font-medium">Version: {versionId}</span>
        <Badge variant="outline" className="text-xs">
          {nodes.length} span{nodes.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {isExpanded && (
        <div className="mt-0.5">
          {nodes.map((node) => (
            <TraceNode
              key={node.spanId}
              node={node}
              onSpanSelect={onSpanSelect}
              selectedSpanId={selectedSpanId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TraceTree({
  nodes,
  onSpanSelect,
  selectedSpanId,
  level = 0,
}: TraceTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No trace spans found
      </div>
    );
  }

  // Check if we need to group by version_id (for planning phase)
  const shouldGroupByVersion = nodes.some(
    (node) =>
      node.phase === "planning" && node.attributes?.["ctrlplane.version_id"],
  );

  if (shouldGroupByVersion) {
    // Group nodes by version_id
    const versionGroups = new Map<string, TraceTreeNode[]>();
    const ungroupedNodes: TraceTreeNode[] = [];

    nodes.forEach((node) => {
      const versionId = node.attributes?.["ctrlplane.version_id"];
      if (
        node.phase === "planning" &&
        versionId &&
        typeof versionId === "string"
      ) {
        const existing = versionGroups.get(versionId) ?? [];
        existing.push(node);
        versionGroups.set(versionId, existing);
      } else {
        ungroupedNodes.push(node);
      }
    });

    return (
      <div className="space-y-0.5">
        {/* Display ungrouped nodes first */}
        {ungroupedNodes.map((node) => (
          <TraceNode
            key={node.spanId}
            node={node}
            onSpanSelect={onSpanSelect}
            selectedSpanId={selectedSpanId}
            level={level}
          />
        ))}

        {/* Display version groups */}
        {Array.from(versionGroups.entries()).map(([versionId, groupNodes]) => (
          <VersionGroupNode
            key={versionId}
            versionId={versionId}
            nodes={groupNodes}
            onSpanSelect={onSpanSelect}
            selectedSpanId={selectedSpanId}
            level={level}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TraceNode
          key={node.spanId}
          node={node}
          onSpanSelect={onSpanSelect}
          selectedSpanId={selectedSpanId}
          level={level}
        />
      ))}
    </div>
  );
}
