"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { _Badge } from "@ctrlplane/ui/badge";
import { _Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

type DeploymentPerformanceProps = {
  deployments: any[];
  startDate: Date;
  endDate: Date;
};

export const DeploymentPerformance: React.FC<DeploymentPerformanceProps> = ({
  deployments,
  startDate,
  endDate,
}) => {
  const router = useRouter();

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "N/A";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const handleRowClick = (systemSlug: string, deploymentSlug: string) => {
    // Navigate to the deployment details
    router.push(`/${systemSlug}/deployments/${deploymentSlug}`);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Deployment Performance</CardTitle>
          <span className="text-xs text-muted-foreground">
            {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deployment</TableHead>
                <TableHead>System</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Avg</TableHead>
                <TableHead>p90</TableHead>
                <TableHead>Last Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      No deployments found
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                deployments.map((deployment) => (
                  <TableRow
                    key={deployment.id}
                    className="cursor-pointer hover:bg-muted/10"
                    onClick={() =>
                      handleRowClick(deployment.systemSlug, deployment.slug)
                    }
                  >
                    <TableCell className="font-medium">
                      {deployment.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {deployment.systemName}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {typeof deployment.totalJobs === 'number' ? String(deployment.totalJobs).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : 0}
                    </TableCell>
                    <TableCell>
                      {deployment.successRate ? (
                        <div
                          className={`text-sm ${
                            deployment.successRate >= 90
                              ? "text-green-600"
                              : deployment.successRate >= 70
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {(deployment.successRate as number).toFixed(1)}%
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(deployment.p50) !== "N/A"
                        ? formatDuration(deployment.p50)
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(deployment.p90) !== "N/A"
                        ? formatDuration(deployment.p90)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {deployment.lastRunAt ? (
                        <div className="text-sm">
                          {format(
                            new Date(deployment.lastRunAt),
                            "MMM d, HH:mm",
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
