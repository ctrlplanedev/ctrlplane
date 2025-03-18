"use client";

import { useState } from "react";
import { IconFilter, IconSearch } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Input } from "@ctrlplane/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { DeploymentDetail } from "./DeploymentDetail";

// Helper function for rendering status badges
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusLower = status.toLowerCase();
  if (statusLower === "success")
    return (
      <Badge
        variant="outline"
        className="border-green-500/30 bg-green-500/10 text-green-400"
      >
        Success
      </Badge>
    );
  if (statusLower === "running")
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-400"
      >
        Running
      </Badge>
    );
  if (statusLower === "deploying")
    return (
      <Badge
        variant="outline"
        className="border-blue-500/30 bg-blue-500/10 text-blue-400"
      >
        Deploying
      </Badge>
    );
  if (statusLower === "pending")
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-400"
      >
        Pending
      </Badge>
    );
  if (statusLower === "failed")
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-400"
      >
        Failed
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
    >
      {status}
    </Badge>
  );
};

export const EnvironmentDeploymentsPageContent: React.FC<{
  environmentId: string;
}> = () => {
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);
  // Sample static deployment data - would be replaced with API data in a real implementation
  const deployments = [
    {
      id: "dep-123",
      name: "Frontend Service",
      status: "success",
      version: "v2.1.0",
      deployedAt: new Date("2024-03-15T14:30:00"),
      duration: 248, // in seconds
      resources: 5,
      initiatedBy: "Jane Smith",
      successRate: 100,
    },
    {
      id: "dep-122",
      name: "API Gateway",
      status: "pending",
      version: "v3.4.1",
      deployedAt: new Date("2024-03-14T10:15:00"),
      duration: null, // pending
      resources: 12,
      initiatedBy: "CI/CD Pipeline",
      successRate: null,
    },
    {
      id: "dep-121",
      name: "Database Service",
      status: "success",
      version: "v3.4.1",
      deployedAt: new Date("2024-03-12T09:45:00"),
      duration: 183, // in seconds
      resources: 9,
      initiatedBy: "John Doe",
      successRate: 100,
    },
    {
      id: "dep-120",
      name: "Cache Service",
      status: "failed",
      version: "v2.0.0",
      deployedAt: new Date("2024-03-10T16:20:00"),
      duration: 127, // in seconds
      resources: 4,
      initiatedBy: "CI/CD Pipeline",
      successRate: 25,
    },
    {
      id: "dep-119",
      name: "Backend Service",
      status: "success",
      version: "v4.1.0",
      deployedAt: new Date("2024-03-05T11:30:00"),
      duration: 312, // in seconds
      resources: 7,
      initiatedBy: "Jane Smith",
      successRate: 100,
    },
  ];

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "—";

    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      {/* Deployment Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Total Deployments</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">42</div>
          <div className="mt-1 flex items-center text-xs text-green-400">
            <span>↑ 8% from previous period</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Success Rate</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-green-400">
            89.7%
          </div>
          <div className="mt-1 flex items-center text-xs text-green-400">
            <span>↑ 3.2% from previous period</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: "89.7%" }}
            ></div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Avg. Duration</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">
            3m 42s
          </div>
          <div className="mt-1 flex items-center text-xs text-red-400">
            <span>↑ 12% from previous period</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Deployment Frequency</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">
            1.4/day
          </div>
          <div className="mt-1 flex items-center text-xs text-green-400">
            <span>↑ 15% from previous period</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search deployments..."
            className="w-full pl-8 md:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="cursor-pointer">
            <IconFilter className="mr-1 h-3.5 w-3.5" />
            Filter
          </Badge>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Deployments</option>
            <option value="recent">Last 7 Days</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Components</option>
            <option value="frontend">Frontend</option>
            <option value="api">API</option>
            <option value="backend">Backend</option>
            <option value="database">Database</option>
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="duration">Duration (longest)</option>
            <option value="success">Success Rate</option>
          </select>
        </div>
      </div>

      <div className="rounded-md border border-neutral-800">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-neutral-800 hover:bg-transparent">
              <TableHead className="w-1/5 font-medium text-neutral-400">
                Component
              </TableHead>
              <TableHead className="w-1/6 font-medium text-neutral-400">
                Version
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Resources
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Duration
              </TableHead>
              <TableHead className="w-1/8 font-medium text-neutral-400">
                Success Rate
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Deployed By
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Timestamp
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((deployment) => (
              <TableRow
                key={deployment.id}
                className="cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/20"
                onClick={() => setSelectedDeployment(deployment)}
              >
                <TableCell className="py-3 font-medium text-neutral-200">
                  {deployment.name}
                </TableCell>
                <TableCell className="py-3 text-neutral-300">
                  {deployment.version}
                </TableCell>
                <TableCell className="py-3">
                  <StatusBadge status={deployment.status} />
                </TableCell>
                <TableCell className="py-3 text-neutral-300">
                  {deployment.resources}
                </TableCell>

                <TableCell className="py-3 text-neutral-300">
                  {formatDuration(deployment.duration)}
                </TableCell>
                <TableCell className="py-3">
                  {deployment.successRate !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${
                            deployment.successRate > 90
                              ? "bg-green-500"
                              : deployment.successRate > 70
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${deployment.successRate}%` }}
                        />
                      </div>
                      <span className="text-sm">{deployment.successRate}%</span>
                    </div>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-neutral-300">
                  {deployment.initiatedBy}
                </TableCell>
                <TableCell className="py-3 text-sm text-neutral-400">
                  {formatTimeAgo(deployment.deployedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
        <div>Showing 5 of 42 deployments</div>
        <div className="flex gap-2">
          <button className="rounded-md border border-neutral-800 px-3 py-1 transition-colors hover:bg-neutral-800/30">
            Previous
          </button>
          <button className="rounded-md border border-neutral-800 bg-neutral-800/40 px-3 py-1 transition-colors hover:bg-neutral-800/60">
            Next
          </button>
        </div>
      </div>

      {selectedDeployment && (
        <DeploymentDetail
          deployment={selectedDeployment}
          onClose={() => setSelectedDeployment(null)}
        />
      )}
    </div>
  );
};
