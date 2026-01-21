import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, ExternalLink, Loader2, X } from "lucide-react";

import { cn } from "~/lib/utils";
import {
  getArgoCDAppUrl,
  getArgoCDStatus,
  parseArgoCDMeasurement,
  parseArgoCDProvider,
} from "./argocd-metric";

type VerificationMetricStatus =
  WorkspaceEngine["schemas"]["VerificationMetricStatus"];

const healthStatusConfig: Record<
  string,
  { icon: React.ReactNode; className: string }
> = {
  Healthy: {
    icon: <Check className="h-4 w-4" />,
    className: "text-green-500",
  },
  Progressing: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    className: "text-blue-500",
  },
  Degraded: {
    icon: <X className="h-4 w-4" />,
    className: "text-red-500",
  },
  Suspended: {
    icon: <Loader2 className="h-4 w-4" />,
    className: "text-yellow-500",
  },
  Missing: {
    icon: <X className="h-4 w-4" />,
    className: "text-red-500",
  },
  Unknown: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    className: "text-muted-foreground",
  },
};

const syncStatusConfig: Record<string, { label: string; className: string }> = {
  Synced: { label: "Synced", className: "text-green-500" },
  OutOfSync: { label: "Out of Sync", className: "text-yellow-500" },
  Unknown: { label: "Unknown", className: "text-muted-foreground" },
};

export function ArgoCDVerificationDisplay({
  metric,
}: {
  metric: VerificationMetricStatus;
}) {
  const sortedMeasurements = [...metric.measurements].sort(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );
  const latestMeasurement = sortedMeasurements.at(0);
  if (latestMeasurement == null) return null;

  const { data } = latestMeasurement;
  if (data == null) return null;

  const parsedData = parseArgoCDMeasurement(data);
  if (parsedData == null) return null;

  const status = getArgoCDStatus(parsedData);
  const healthConfig = healthStatusConfig[status.healthStatus] ??
    healthStatusConfig.Unknown ?? { icon: null, className: "" };
  const syncConfig = syncStatusConfig[status.syncStatus] ??
    syncStatusConfig.Unknown ?? { label: "Unknown", className: "" };

  const provider = parseArgoCDProvider(metric.provider);
  const appUrl = provider
    ? getArgoCDAppUrl(provider.url, status.namespace)
    : null;

  return (
    <div className="space-y-2 pl-1 pr-2">
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <div className="text-muted-foreground">Health</div>
          <div className={cn(healthConfig.className)}>
            {status.healthStatus}
          </div>
        </div>
        <div className="flex justify-between">
          <div className="text-muted-foreground">Sync</div>
          <div className={cn(syncConfig.className)}>{syncConfig.label}</div>
        </div>

        {appUrl && (
          <div className="flex justify-between">
            <div className="text-muted-foreground">App URL</div>
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {status.name}
            </a>
          </div>
        )}

        {status.revision && (
          <div className="flex justify-between">
            <div className="text-muted-foreground">Revision</div>
            <div className="font-mono">{status.revision.slice(0, 7)}</div>
          </div>
        )}

        {status.reconciledAt && (
          <div className="flex justify-between">
            <div className="text-muted-foreground">Last Synced</div>
            <div>
              {formatDistanceToNowStrict(new Date(status.reconciledAt), {
                addSuffix: true,
              })}
            </div>
          </div>
        )}

        {status.resourceCount != null && (
          <div className="flex justify-between">
            <div className="text-muted-foreground">Resources</div>
            <div>{status.resourceCount}</div>
          </div>
        )}
      </div>
    </div>
  );
}
