import {
  IconAlertCircle,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

type Policy = {
  enabled: boolean;
  denyWindows: { id: string }[];
  deploymentVersionSelector: { id: string } | null;
  versionAnyApprovals: { id: string } | null;
  versionUserApprovals: { id: string }[];
  versionRoleApprovals: { id: string }[];
  concurrency: { id: string } | null;
};

export const PolicyOverviewCard: React.FC<{ policy: Policy }> = ({
  policy,
}) => {
  const {
    enabled,
    denyWindows,
    deploymentVersionSelector,
    versionAnyApprovals,
    versionUserApprovals,
    versionRoleApprovals,
    concurrency,
  } = policy;

  const hasDenyWindows = denyWindows.length > 0;
  const hasApprovals =
    versionAnyApprovals != null ||
    versionUserApprovals.length > 0 ||
    versionRoleApprovals.length > 0;
  const hasDeploymentVersionSelector = deploymentVersionSelector != null;
  const hasConcurrency = concurrency != null;
  const hasRules =
    hasDenyWindows ||
    hasApprovals ||
    hasDeploymentVersionSelector ||
    hasConcurrency;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Policy Rules
            </h3>
            {!hasRules && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconInfoCircle className="h-4 w-4" />
                <span>No rules configured</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {hasApprovals && (
                <Badge
                  variant="outline"
                  className="border-blue-500 text-blue-500"
                >
                  Approval Gate
                </Badge>
              )}
              {hasDenyWindows && (
                <Badge
                  variant="outline"
                  className="border-red-500 text-red-500"
                >
                  Deny Window
                </Badge>
              )}
              {hasDeploymentVersionSelector && (
                <Badge
                  variant="outline"
                  className="border-purple-500 text-purple-500"
                >
                  Version Conditions
                </Badge>
              )}
              {hasConcurrency && (
                <Badge
                  variant="outline"
                  className="border-yellow-500 text-yellow-500"
                >
                  Concurrency
                </Badge>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Status
            </h3>
            <div className="flex items-center gap-2">
              {enabled && (
                <div className="flex items-center gap-2 text-green-500">
                  <IconCheck className="h-4 w-4" />
                  <span>Active and enforcing rules</span>
                </div>
              )}

              {!enabled && (
                <div className="flex items-center gap-2 text-amber-500">
                  <IconAlertCircle className="h-4 w-4" />
                  <span>Disabled - not enforcing rules</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
