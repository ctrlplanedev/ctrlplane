import prettyMs from "pretty-ms";

export type DeploymentTraceSpan = {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTime: Date;
  endTime: Date | null;
  workspaceId: string;
  releaseTargetKey: string | null;
  releaseId: string | null;
  jobId: string | null;
  parentTraceId: string | null;
  phase: string | null;
  nodeType: string | null;
  status: string | null;
  depth: number | null;
  sequence: number | null;
  attributes: Record<string, any> | null;
  events: Array<{
    name: string;
    timestamp: string;
    attributes: Record<string, any>;
  }> | null;
  createdAt: Date;
};

export interface TraceTreeNode extends DeploymentTraceSpan {
  children: TraceTreeNode[];
}

/**
 * Build a tree structure from a flat list of spans
 */
export function buildTraceTree(spans: DeploymentTraceSpan[]): TraceTreeNode[] {
  const spanMap = new Map<string, TraceTreeNode>();
  const rootNodes: TraceTreeNode[] = [];

  // First pass: Create nodes for all spans
  spans.forEach((span) => {
    spanMap.set(span.spanId, { ...span, children: [] });
  });

  // Second pass: Build the tree structure
  spans.forEach((span) => {
    const node = spanMap.get(span.spanId);
    if (!node) return;

    if (span.parentSpanId) {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    } else {
      // No parent, this is a root node
      rootNodes.push(node);
    }
  });

  // Sort children by sequence number if available
  const sortChildren = (node: TraceTreeNode) => {
    if (node.children.length > 0) {
      node.children.sort((a, b) => {
        if (a.sequence !== null && b.sequence !== null) {
          return a.sequence - b.sequence;
        }
        // Fall back to start time if sequence not available
        return (
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      });
      node.children.forEach(sortChildren);
    }
  };

  rootNodes.forEach(sortChildren);
  return rootNodes;
}

/**
 * Calculate the duration of a span in milliseconds
 */
export function calculateSpanDuration(
  span: DeploymentTraceSpan,
): number | null {
  if (!span.endTime) return null;
  return new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
}

/**
 * Format duration in a human-readable format
 */
export function formatDuration(durationMs: number | null): string {
  return durationMs === null ? "In progress" : prettyMs(durationMs);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Format relative time (how long ago)
 */
export function formatRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Get status color class for badges
 */
export function getStatusColor(status: string | null): string {
  if (!status) return "bg-gray-500";

  const statusLower = status.toLowerCase();

  if (statusLower.includes("completed") || statusLower.includes("allowed")) {
    return "bg-green-500";
  }

  if (
    statusLower.includes("denied") ||
    statusLower.includes("failed") ||
    statusLower.includes("error")
  ) {
    return "bg-red-500";
  }

  if (statusLower.includes("pending") || statusLower.includes("running")) {
    return "bg-yellow-500";
  }

  return "bg-blue-500";
}

/**
 * Get phase color class for badges
 */
export function getPhaseColor(phase: string | null): string {
  if (!phase) return "bg-gray-500";

  const phaseLower = phase.toLowerCase();

  if (phaseLower.includes("planning")) {
    return "bg-purple-500";
  }

  if (phaseLower.includes("evaluation")) {
    return "bg-blue-500";
  }

  if (phaseLower.includes("execution")) {
    return "bg-orange-500";
  }

  return "bg-gray-500";
}

/**
 * Get all descendant spans from a node
 */
export function getAllDescendants(node: TraceTreeNode): TraceTreeNode[] {
  const descendants: TraceTreeNode[] = [];

  const collectDescendants = (n: TraceTreeNode) => {
    n.children.forEach((child) => {
      descendants.push(child);
      collectDescendants(child);
    });
  };

  collectDescendants(node);
  return descendants;
}

/**
 * Count total spans in a trace tree
 */
export function countSpans(nodes: TraceTreeNode[]): number {
  let count = nodes.length;
  nodes.forEach((node) => {
    count += countSpans(node.children);
  });
  return count;
}

/**
 * Extract environment and resource information from span
 */
export function getSpanContext(span: DeploymentTraceSpan): {
  environment?: string;
  resource?: string;
} {
  const attrs = span.attributes ?? {};
  
  return {
    environment: typeof attrs["ctrlplane.environment"] === "string" 
      ? attrs["ctrlplane.environment"] 
      : undefined,
    resource: typeof attrs["ctrlplane.resource"] === "string"
      ? attrs["ctrlplane.resource"]
      : undefined,
  };
}

/**
 * Extract useful display information from span attributes
 */
export function getSpanDisplayInfo(span: DeploymentTraceSpan): {
  primaryText: string;
  secondaryText?: string;
  reason?: string;
  environment?: string;
  resource?: string;
} {
  const attrs = span.attributes ?? {};

  // Check for common useful attributes
  const name =
    attrs.name ?? attrs.label ?? attrs.resourceName ?? attrs.targetName;
  const type = attrs.type ?? attrs.kind ?? attrs.action;
  const identifier = attrs.id ?? attrs.identifier ?? attrs.key;
  
  // Extract reason/message information
  const reason = attrs.reason ?? attrs.message ?? attrs.error ?? attrs.description;
  
  // Extract environment and resource
  const context = getSpanContext(span);

  // Build descriptive text
  let primaryText = span.name;
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
  if (identifier && typeof identifier === "string" && !primaryText.includes(identifier)) {
    secondaryText = secondaryText ? `${secondaryText} (${identifier})` : identifier;
  }

  return { 
    primaryText, 
    secondaryText,
    reason: reason && typeof reason === "string" ? reason : undefined,
    environment: context.environment,
    resource: context.resource,
  };
}
