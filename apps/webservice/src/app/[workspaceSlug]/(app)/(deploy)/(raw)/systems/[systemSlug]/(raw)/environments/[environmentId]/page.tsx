"use client";

import React from "react";
import Link from "next/link";
import {
  IconAdjustments,
  IconArrowUpRight,
  IconClock,
  IconFilter,
  IconHelpCircle,
  IconInfoCircle,
  IconSearch,
  IconShield,
  IconShieldCheck,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import prettyMs from "pretty-ms";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

// Helper time formatting functions
const formatTimeAgo = (date: Date) => {
  return formatDistanceToNowStrict(date, { addSuffix: true });
};

const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds) return "N/A";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
};

// Helper function for rendering status badges
const renderStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "success":
      return (
        <Badge
          variant="outline"
          className="border-green-500/30 bg-green-500/10 text-green-400"
        >
          Success
        </Badge>
      );
    case "pending":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-400"
        >
          Pending
        </Badge>
      );
    case "running":
    case "deploying":
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 bg-blue-500/10 text-blue-400"
        >
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-red-500/30 bg-red-500/10 text-red-400"
        >
          Failed
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
        >
          {status}
        </Badge>
      );
  }
};

// DeploymentDetail component for showing details of a selected deployment
const DeploymentDetail: React.FC<{
  deployment: any;
  onClose: () => void;
}> = ({ deployment, onClose }) => {
  if (!deployment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="max-h-[90vh] w-3/4 max-w-4xl overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <h3 className="text-lg font-medium text-neutral-100">
            Deployment Details: {deployment.name}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Deployment Header with Status Banner */}
          <div
            className={`-mx-6 -mt-6 mb-6 flex items-center justify-between px-6 py-4 ${
              deployment.status === "success"
                ? "bg-green-500/10"
                : deployment.status === "pending"
                  ? "bg-amber-500/10"
                  : deployment.status === "failed"
                    ? "bg-red-500/10"
                    : "bg-blue-500/10"
            }`}
          >
            <div>
              <h3 className="text-lg font-medium text-neutral-100">
                {deployment.name} • {deployment.version}
              </h3>
              <p className="text-sm text-neutral-400">
                Deployed {formatTimeAgo(deployment.deployedAt)}
              </p>
            </div>
            <div>{renderStatusBadge(deployment.status)}</div>
          </div>

          {/* Deployment Info Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-1 text-sm font-medium text-neutral-400">
                    Started
                  </h4>
                  <p className="text-neutral-200">
                    {deployment.deployedAt.toLocaleString()}
                  </p>
                </div>

                <div>
                  <h4 className="mb-1 text-sm font-medium text-neutral-400">
                    Duration
                  </h4>
                  <p className="text-neutral-200">
                    {formatDuration(deployment.duration)}
                  </p>
                </div>

                <div>
                  <h4 className="mb-1 text-sm font-medium text-neutral-400">
                    Initiated By
                  </h4>
                  <p className="text-neutral-200">{deployment.initiatedBy}</p>
                </div>

                <div>
                  <h4 className="mb-1 text-sm font-medium text-neutral-400">
                    Resources
                  </h4>
                  <p className="text-neutral-200">{deployment.resources}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-neutral-400">
                  Configuration
                </h4>
                <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3 text-xs">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="text-neutral-400">Release Channel</div>
                    <div className="text-neutral-200">production</div>

                    <div className="text-neutral-400">Target Environment</div>
                    <div className="text-neutral-200">Production</div>

                    <div className="text-neutral-400">Rollout Strategy</div>
                    <div className="text-neutral-200">Gradual (30min)</div>

                    <div className="text-neutral-400">Required Approval</div>
                    <div className="text-neutral-200">Manual</div>

                    <div className="text-neutral-400">Trigger</div>
                    <div className="text-neutral-200">Manual</div>

                    <div className="text-neutral-400">Commit</div>
                    <div className="font-mono text-neutral-200">8fc12a3</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-neutral-400">
                  Success Rate
                </h4>
                {deployment.successRate !== null ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-300">
                        Overall Status
                      </span>
                      <span
                        className={`text-sm ${
                          deployment.successRate > 90
                            ? "text-green-400"
                            : deployment.successRate > 70
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {deployment.successRate}% Success
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-800">
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
                    {deployment.status === "failed" && (
                      <p className="mt-2 text-xs text-neutral-400">
                        Failure occurred during resource configuration step. See
                        logs for more details.
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral-500">
                    Deployment still in progress
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h4 className="mb-2 text-sm font-medium text-neutral-400">
                  Deployment Timeline
                </h4>
                <div className="relative">
                  <div className="absolute bottom-2 left-2.5 top-2 w-0.5 bg-neutral-800"></div>
                  <div className="space-y-3">
                    <div className="relative pl-7">
                      <div
                        className={`absolute left-0 top-1 h-5 w-5 rounded-full ${deployment.status !== "failed" ? "border-2 border-green-500 bg-green-500/20" : "border border-neutral-700 bg-neutral-800/80"} flex items-center justify-center`}
                      >
                        <span className="text-xs">1</span>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-200">Validation</p>
                        <p className="text-xs text-neutral-400">
                          Configuration validated successfully
                        </p>
                      </div>
                    </div>
                    <div className="relative pl-7">
                      <div
                        className={`absolute left-0 top-1 h-5 w-5 rounded-full ${deployment.status !== "failed" ? "border-2 border-green-500 bg-green-500/20" : "border border-neutral-700 bg-neutral-800/80"} flex items-center justify-center`}
                      >
                        <span className="text-xs">2</span>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-200">
                          Resource Preparation
                        </p>
                        <p className="text-xs text-neutral-400">
                          Resources prepared for deployment
                        </p>
                      </div>
                    </div>
                    <div className="relative pl-7">
                      <div
                        className={`absolute left-0 top-1 h-5 w-5 rounded-full ${
                          deployment.status === "success"
                            ? "border-2 border-green-500 bg-green-500/20"
                            : deployment.status === "failed"
                              ? "border-2 border-red-500 bg-red-500/20"
                              : deployment.status === "pending"
                                ? "border border-neutral-700 bg-neutral-800/80"
                                : "border-2 border-blue-500 bg-blue-500/20"
                        } flex items-center justify-center`}
                      >
                        <span className="text-xs">3</span>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-200">
                          Deployment Execution
                        </p>
                        <p
                          className={`text-xs ${
                            deployment.status === "success"
                              ? "text-green-400"
                              : deployment.status === "failed"
                                ? "text-red-400"
                                : deployment.status === "pending"
                                  ? "text-neutral-400"
                                  : "text-blue-400"
                          }`}
                        >
                          {deployment.status === "success"
                            ? "Completed successfully"
                            : deployment.status === "failed"
                              ? "Failed with errors"
                              : deployment.status === "pending"
                                ? "Waiting to start"
                                : "In progress..."}
                        </p>
                      </div>
                    </div>
                    <div className="relative pl-7">
                      <div
                        className={`absolute left-0 top-1 h-5 w-5 rounded-full ${
                          deployment.status === "success"
                            ? "border-2 border-green-500 bg-green-500/20"
                            : "border border-neutral-700 bg-neutral-800/80"
                        } flex items-center justify-center`}
                      >
                        <span className="text-xs">4</span>
                      </div>
                      <div>
                        <p className="text-sm text-neutral-200">Health Check</p>
                        <p className="text-xs text-neutral-400">
                          {deployment.status === "success"
                            ? "All resources healthy"
                            : "Pending completion"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-neutral-400">
                  Deployment Logs
                </h4>
                <div className="max-h-44 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs">
                  <p className="text-green-400">
                    [
                    {new Date(
                      deployment.deployedAt.getTime(),
                    ).toLocaleTimeString()}
                    ] Starting deployment of {deployment.name} version{" "}
                    {deployment.version}...
                  </p>
                  <p className="text-neutral-400">
                    [
                    {new Date(
                      deployment.deployedAt.getTime() + 15000,
                    ).toLocaleTimeString()}
                    ] Connecting to resource cluster...
                  </p>
                  <p className="text-neutral-400">
                    [
                    {new Date(
                      deployment.deployedAt.getTime() + 32000,
                    ).toLocaleTimeString()}
                    ] Validation checks passed.
                  </p>
                  <p className="text-neutral-400">
                    [
                    {new Date(
                      deployment.deployedAt.getTime() + 48000,
                    ).toLocaleTimeString()}
                    ] Creating deployment plan for {deployment.resources}{" "}
                    resources...
                  </p>
                  <p className="text-neutral-400">
                    [
                    {new Date(
                      deployment.deployedAt.getTime() + 62000,
                    ).toLocaleTimeString()}
                    ] Updating configuration...
                  </p>
                  <p className="text-neutral-400">
                    [
                    {new Date(
                      deployment.deployedAt.getTime() + 95000,
                    ).toLocaleTimeString()}
                    ] Applying changes to resources...
                  </p>
                  {deployment.status === "success" ? (
                    <>
                      <p className="text-neutral-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 145000,
                        ).toLocaleTimeString()}
                        ] Running post-deployment verification...
                      </p>
                      <p className="text-neutral-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 180000,
                        ).toLocaleTimeString()}
                        ] All health checks passed.
                      </p>
                      <p className="text-green-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 185000,
                        ).toLocaleTimeString()}
                        ] Deployment completed successfully!
                      </p>
                    </>
                  ) : deployment.status === "failed" ? (
                    <>
                      <p className="text-neutral-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 110000,
                        ).toLocaleTimeString()}
                        ] Updating resource '{deployment.name}-1'...
                      </p>
                      <p className="text-red-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 125000,
                        ).toLocaleTimeString()}
                        ] Error: Failed to update resource '{deployment.name}
                        -1'.
                      </p>
                      <p className="text-red-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 126000,
                        ).toLocaleTimeString()}
                        ] Error details: Configuration validation failed -
                        insufficient permissions.
                      </p>
                      <p className="text-neutral-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 127000,
                        ).toLocaleTimeString()}
                        ] Rolling back changes...
                      </p>
                      <p className="text-red-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 135000,
                        ).toLocaleTimeString()}
                        ] Deployment failed. See detailed logs for more
                        information.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-blue-400">
                        [
                        {new Date(
                          deployment.deployedAt.getTime() + 105000,
                        ).toLocaleTimeString()}
                        ] Currently updating resource {deployment.name}-3...
                      </p>
                      <p className="text-blue-400">
                        [{new Date().toLocaleTimeString()}] Deployment in
                        progress (2/{deployment.resources} resources
                        completed)...
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-neutral-400">
              Affected Resources
            </h4>
            <div className="overflow-hidden rounded-md border border-neutral-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-neutral-800 hover:bg-transparent">
                    <TableHead className="font-medium text-neutral-400">
                      Resource Name
                    </TableHead>
                    <TableHead className="font-medium text-neutral-400">
                      Type
                    </TableHead>
                    <TableHead className="font-medium text-neutral-400">
                      Region
                    </TableHead>
                    <TableHead className="font-medium text-neutral-400">
                      Previous Version
                    </TableHead>
                    <TableHead className="font-medium text-neutral-400">
                      Current Version
                    </TableHead>
                    <TableHead className="font-medium text-neutral-400">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({
                    length: Math.min(3, deployment.resources),
                  }).map((_, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-neutral-800/50"
                    >
                      <TableCell className="text-neutral-200">
                        {deployment.name}-{i + 1}
                      </TableCell>
                      <TableCell className="text-neutral-300">
                        {deployment.name.includes("Database")
                          ? "Database"
                          : deployment.name.includes("Cache")
                            ? "Cache"
                            : "Service"}
                      </TableCell>
                      <TableCell className="text-neutral-300">
                        us-west-{i + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-neutral-400">
                        {i === 0 && deployment.name.includes("Frontend")
                          ? "v2.0.0"
                          : i === 0 && deployment.name.includes("Database")
                            ? "v3.3.0"
                            : i === 0 && deployment.name.includes("API")
                              ? "v2.8.5"
                              : i === 0 && deployment.name.includes("Cache")
                                ? "v1.9.2"
                                : i === 0 && deployment.name.includes("Backend")
                                  ? "v4.0.0"
                                  : "v1.0.0"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-neutral-200">
                        {deployment.version}
                      </TableCell>
                      <TableCell>
                        {deployment.status === "failed" && i === 0 ? (
                          <Badge
                            variant="outline"
                            className="border-red-500/30 bg-red-500/10 text-red-400"
                          >
                            Failed
                          </Badge>
                        ) : deployment.status === "pending" ? (
                          <Badge
                            variant="outline"
                            className="border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
                          >
                            Pending
                          </Badge>
                        ) : deployment.status === "running" && i > 1 ? (
                          <Badge
                            variant="outline"
                            className="border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
                          >
                            Pending
                          </Badge>
                        ) : deployment.status === "running" && i <= 1 ? (
                          <Badge
                            variant="outline"
                            className="border-blue-500/30 bg-blue-500/10 text-blue-400"
                          >
                            In Progress
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-green-500/30 bg-green-500/10 text-green-400"
                          >
                            Success
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-800 p-4">
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Logs
            </button>
            {deployment.status === "success" && (
              <button className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="10 8 16 12 10 16 10 8"></polygon>
                </svg>
                View Live Status
              </button>
            )}
            {deployment.status === "failed" && (
              <button className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Add to Alerts
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Close
            </button>
            {deployment.status === "failed" && (
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2v6h-6"></path>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                  <path d="M3 22v-6h6"></path>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                </svg>
                Retry Deployment
              </button>
            )}
            {deployment.status === "success" && (
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Rollback
              </button>
            )}
            {deployment.status === "pending" && (
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Start Deployment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// PoliciesTabContent component for the Policies tab
const PoliciesTabContent: React.FC<{ environmentId: string }> = ({
  environmentId,
}) => {
  const hasParentPolicy = true;
  // Sample static policy data
  const environmentPolicy = {
    id: "env-pol-1",
    name: "Production Environment Policy",
    description: "Policy settings for the production environment",
    environmentId: environmentId,
    approvalRequirement: "manual",
    successType: "all",
    successMinimum: 0,
    concurrencyLimit: 2,
    rolloutDuration: 1800000, // 30 minutes in ms
    minimumReleaseInterval: 86400000, // 24 hours in ms
    releaseSequencing: "wait",
    versionChannels: [
      { id: "channel-1", name: "stable", deploymentId: "deploy-1" },
      { id: "channel-2", name: "beta", deploymentId: "deploy-2" },
    ],
    releaseWindows: [
      {
        id: "window-1",
        recurrence: "weekly",
        startTime: new Date("2025-03-18T09:00:00"),
        endTime: new Date("2025-03-18T17:00:00"),
      },
    ],
  };

  const formatDurationText = (ms: number) => {
    if (ms === 0) return "None";
    return prettyMs(ms, { compact: true, verbose: false });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Environment Policies</CardTitle>
          <CardDescription>
            Policies control how and when deployments can occur in this
            environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasParentPolicy && (
            <Alert
              variant="warning"
              className="mb-6 flex items-center bg-orange-500/5"
            >
              <IconInfoCircle className="h-4 w-4 " />
              <div className="mt-1.5 flex-1">
                <AlertTitle className="">Inherited Parent Policies</AlertTitle>
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <p className="">
                      These policies are inherited from a parent configuration.
                      You can override specific settings at the environment
                      level while maintaining the parent policy structure.
                    </p>
                  </div>
                </AlertDescription>
              </div>

              <div>
                <Button variant="ghost" size="sm" className="shrink-0" asChild>
                  <Link
                    href="/parent-policy"
                    className="flex items-center gap-1"
                  >
                    View parent policy
                    <IconArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Approval & Governance */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconShieldCheck className="h-5 w-5 text-blue-400" />
                    Approval & Governance
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls who can approve deployments and what
                            validation criteria must be met before a deployment
                            can proceed to this environment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-neutral-400">
                    Approval Required
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconInfoCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Approval required for deployments to this
                            environment.{" "}
                            <Link
                              href="https://docs.ctrlplane.com/environments/approval-policies"
                              className="text-blue-400 hover:underline"
                            >
                              Learn more
                            </Link>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="text-right font-medium">
                    <Badge
                      variant={
                        environmentPolicy.approvalRequirement === "manual"
                          ? "default"
                          : "secondary"
                      }
                      className="font-normal"
                    >
                      {environmentPolicy.approvalRequirement === "manual"
                        ? "Yes"
                        : "No"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-neutral-400">
                    Success Criteria
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Defines the success requirements for deployments.
                            Can be set to require all resources to succeed, a
                            minimum number of resources, or no validation.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Deployment Control */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconAdjustments className="h-5 w-5 text-indigo-400" />
                    Deployment Control
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Settings that control how deployments are executed
                            and managed in this environment, including
                            concurrency and resource limits.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-neutral-400">Concurrency Limit</div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.concurrencyLimit
                      ? `Max ${environmentPolicy.concurrencyLimit} jobs`
                      : "Unlimited"}
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Release Management */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconSwitchHorizontal className="h-5 w-5 text-emerald-400" />
                    Release Management
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls how releases are managed, including how new
                            versions are handled and how deployments are
                            sequenced in this environment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    Job Sequencing
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls what happens to pending jobs when a new
                            version is created. You can either keep pending jobs
                            in the queue or cancel them in favor of the new
                            version.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.releaseSequencing === "wait"
                      ? "Keep pending jobs"
                      : "Cancel pending jobs"}
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Deployment Version Channels */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconShield className="h-5 w-5 text-amber-400" />
                    Version Channels
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Manages which version channels are available and how
                            versions flow through different stages in this
                            environment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    Channels Configured
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Deployment version channels let you establish a
                            consistent flow of versions. For example, versions
                            might flow from beta → stable.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.versionChannels.length}
                  </div>

                  {environmentPolicy.versionChannels.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 text-neutral-400">
                        Assigned Channels
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[350px]">
                              <p>
                                Channels assigned to this environment control
                                which versions can be deployed. Only versions
                                published to these channels will be deployed
                                here.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-right">
                        <div className="space-x-1">
                          {environmentPolicy.versionChannels.map((channel) => (
                            <Badge
                              key={channel.id}
                              variant="outline"
                              className="bg-amber-950/20 text-amber-300"
                            >
                              {channel.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Rollout & Timing */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconClock className="h-5 w-5 text-rose-400" />
                    Rollout & Timing
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls the timing aspects of deployments,
                            including rollout duration, release intervals, and
                            deployment windows.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    Rollout Duration
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            The time over which deployments will be gradually
                            rolled out to this environment. A longer duration
                            provides more time to monitor and catch issues
                            during deployment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {formatDurationText(environmentPolicy.rolloutDuration)}
                  </div>

                  <div className="flex items-center gap-1 text-neutral-400">
                    Release Interval
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Minimum time that must pass between active releases
                            to this environment. This "cooling period" helps
                            ensure stability between deployments.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.releaseWindows.length}
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ResourcesTabContent component for the Resources tab
const ResourcesTabContent: React.FC<{ environmentId: string }> = ({
  environmentId,
}) => {
  const [selectedView, setSelectedView] = React.useState("grid");
  const [showFilterEditor, setShowFilterEditor] = React.useState(false);
  const [resourceFilter, setResourceFilter] = React.useState({
    type: "comparison",
    operator: "and",
    not: false,
    conditions: [
      {
        type: "kind",
        operator: "equals",
        not: false,
        value: "Pod",
      },
    ],
  });

  // Sample static resource data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resources = [
    {
      id: "res-1",
      name: "api-server-pod-1",
      kind: "Pod",
      provider: "kubernetes",
      region: "us-west-2",
      status: "healthy",
      version: "nginx:1.21",
      lastUpdated: new Date("2024-03-15T10:30:00"),
      component: "API Server",
      healthScore: 98,
      metrics: {
        cpu: 32,
        memory: 45,
      },
      events: [
        {
          type: "normal",
          timestamp: new Date("2024-03-15T10:30:00"),
          message: "Pod started successfully",
        },
        {
          type: "normal",
          timestamp: new Date("2024-03-15T10:28:00"),
          message: "Container image pulled successfully",
        },
      ],
      relatedResources: [
        { name: "api-server-service", kind: "Service", status: "healthy" },
        {
          name: "api-data-volume",
          kind: "PersistentVolume",
          status: "healthy",
        },
      ],
      deploymentHistory: [
        {
          date: new Date("2024-03-15"),
          version: "v1.21",
          deploymentName: "API Server Rollout",
          duration: 3,
          status: "success",
        },
        {
          date: new Date("2024-02-28"),
          version: "v1.20",
          deploymentName: "February Release",
          duration: 5,
          status: "success",
        },
      ],
    },
    {
      id: "res-2",
      name: "frontend-service",
      kind: "Service",
      provider: "kubernetes",
      region: "us-west-2",
      status: "healthy",
      version: "ClusterIP",
      lastUpdated: new Date("2024-03-15T09:45:00"),
      component: "Frontend",
      healthScore: 100,
      metrics: {
        cpu: 12,
        memory: 25,
      },
      events: [
        {
          type: "normal",
          timestamp: new Date("2024-03-15T09:45:00"),
          message: "Service created",
        },
      ],
    },
    {
      id: "res-3",
      name: "main-db-instance",
      kind: "Database",
      provider: "aws",
      region: "us-west-2",
      status: "degraded",
      version: "postgres-13.4",
      lastUpdated: new Date("2024-03-14T22:15:00"),
      component: "Database",
      healthScore: 75,
      metrics: {
        cpu: 78,
        memory: 65,
        disk: 82,
      },
      events: [
        {
          type: "warning",
          timestamp: new Date("2024-03-15T02:12:00"),
          message: "High disk usage detected",
        },
        {
          type: "normal",
          timestamp: new Date("2024-03-14T22:15:00"),
          message: "Database backup completed",
        },
      ],
      relatedResources: [
        { name: "db-backup-bucket", kind: "Storage", status: "healthy" },
      ],
    },
    {
      id: "res-4",
      name: "cache-redis-01",
      kind: "Pod",
      provider: "kubernetes",
      region: "us-west-2",
      status: "failed",
      version: "redis:6.2",
      lastUpdated: new Date("2024-03-15T08:12:00"),
      component: "Cache",
      healthScore: 0,
      metrics: {
        cpu: 0,
        memory: 0,
      },
      events: [
        {
          type: "error",
          timestamp: new Date("2024-03-15T08:12:00"),
          message: "Container failed to start: OOMKilled",
        },
        {
          type: "warning",
          timestamp: new Date("2024-03-15T08:11:30"),
          message: "Memory usage exceeded limit",
        },
      ],
    },
    {
      id: "res-5",
      name: "monitoring-server",
      kind: "VM",
      provider: "gcp",
      region: "us-west-1",
      status: "healthy",
      version: "n/a",
      lastUpdated: new Date("2024-03-10T15:30:00"),
      component: "Monitoring",
      healthScore: 96,
      metrics: {
        cpu: 15,
        memory: 40,
        disk: 30,
      },
      events: [
        {
          type: "normal",
          timestamp: new Date("2024-03-10T15:30:00"),
          message: "VM started successfully",
        },
      ],
    },
    {
      id: "res-6",
      name: "backend-pod-1",
      kind: "Pod",
      provider: "kubernetes",
      region: "us-west-2",
      status: "healthy",
      version: "backend:4.1.0",
      lastUpdated: new Date("2024-03-10T11:45:00"),
      component: "Backend",
      healthScore: 99,
      metrics: {
        cpu: 45,
        memory: 38,
      },
      events: [
        {
          type: "normal",
          timestamp: new Date("2024-03-10T11:45:00"),
          message: "Pod started successfully",
        },
      ],
    },
    {
      id: "res-7",
      name: "backend-pod-2",
      kind: "Pod",
      provider: "kubernetes",
      region: "us-west-2",
      status: "healthy",
      version: "backend:4.1.0",
      lastUpdated: new Date("2024-03-10T11:45:00"),
      component: "Backend",
      healthScore: 97,
      metrics: {
        cpu: 49,
        memory: 42,
      },
    },
    {
      id: "res-8",
      name: "analytics-queue",
      kind: "Service",
      provider: "aws",
      region: "us-west-2",
      status: "updating",
      version: "n/a",
      lastUpdated: new Date("2024-03-15T14:22:00"),
      component: "Analytics",
      healthScore: 90,
      metrics: {
        cpu: 28,
        memory: 35,
      },
      events: [
        {
          type: "normal",
          timestamp: new Date("2024-03-15T14:22:00"),
          message: "Service configuration update in progress",
        },
      ],
    },
  ];

  // Group resources by component
  const resourcesByComponent = _(resources)
    .groupBy((t) => t.component)
    .value() as Record<string, typeof resources>;

  // Apply filters to resources
  const filteredResources = React.useMemo(() => {
    // Start with all resources
    let filtered = [...resources];

    // Apply resource condition filters
    if (resourceFilter.conditions.length > 0) {
      // If it's an AND operator, each condition must match
      if (resourceFilter.operator === "and") {
        resourceFilter.conditions.forEach((condition: any) => {
          filtered = filtered.filter((resource) => {
            switch (condition.type) {
              case "kind":
                return resource.kind === condition.value;
              case "provider":
                return resource.provider === condition.value;
              case "status":
                return resource.status === condition.value;
              case "component":
                return resource.component === condition.value;
              default:
                return true;
            }
          });
        });
      }
      // If it's an OR operator, any condition can match
      else if (resourceFilter.operator === "or") {
        filtered = filtered.filter((resource) =>
          resourceFilter.conditions.some((condition: any) => {
            switch (condition.type) {
              case "kind":
                return resource.kind === condition.value;
              case "provider":
                return resource.provider === condition.value;
              case "status":
                return resource.status === condition.value;
              case "component":
                return resource.component === condition.value;
              default:
                return true;
            }
          }),
        );
      }
    }

    return filtered;
  }, [resources, resourceFilter]);

  const getStatusCount = (status: string) => {
    return resources.filter((r) => r.status === status).length;
  };

  const renderResourceCard = (resource: any) => {
    const statusColor = {
      healthy: "bg-green-500",
      degraded: "bg-amber-500",
      failed: "bg-red-500",
      updating: "bg-blue-500",
      unknown: "bg-neutral-500",
    };

    return (
      <div
        key={resource.id}
        className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${statusColor[resource.status as keyof typeof statusColor] || "bg-neutral-500"}`}
            ></div>
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
          <div className="text-neutral-400">Component</div>
          <div className="text-neutral-300">{resource.component}</div>

          <div className="text-neutral-400">Provider</div>
          <div className="text-neutral-300">{resource.provider}</div>

          <div className="text-neutral-400">Region</div>
          <div className="text-neutral-300">{resource.region}</div>

          <div className="text-neutral-400">Updated</div>
          <div className="text-neutral-300">
            {resource.lastUpdated.toLocaleDateString()}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Provider</span>
            <span className="text-neutral-300">{resource.provider}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Deployment Success</span>
            <span
              className={`text-${resource.healthScore > 90 ? "green" : resource.healthScore > 70 ? "amber" : "red"}-400`}
            >
              {resource.healthScore}%
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

  return (
    <div className="space-y-6">
      {/* Resource Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 text-xs text-neutral-400">Total Resources</div>
          <div className="text-2xl font-semibold text-neutral-100">
            {resources.length}
          </div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-neutral-400">
              Across {Object.keys(resourcesByComponent).length} components
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span>Healthy</span>
          </div>
          <div className="text-2xl font-semibold text-green-400">
            {getStatusCount("healthy")}
          </div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-green-400">
              {Math.round((getStatusCount("healthy") / resources.length) * 100)}
              % of resources
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
            <span>Needs Attention</span>
          </div>
          <div className="text-2xl font-semibold text-amber-400">
            {getStatusCount("degraded")}
          </div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-amber-400">
              {getStatusCount("degraded") > 0
                ? "Action required"
                : "No issues detected"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span>Deploying</span>
          </div>
          <div className="text-2xl font-semibold text-blue-400">
            {getStatusCount("updating") + getStatusCount("failed")}
          </div>
          <div className="mt-1 flex items-center text-xs">
            <span className="text-blue-400">
              {getStatusCount("updating") > 0
                ? "Updates in progress"
                : "No active deployments"}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            className="w-full pl-8 md:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="cursor-pointer transition-colors hover:bg-neutral-800/50"
            onClick={() => setShowFilterEditor(true)}
          >
            <IconFilter className="mr-1 h-3.5 w-3.5" />
            {resourceFilter.conditions.length > 0
              ? `Filter (${resourceFilter.conditions.length})`
              : "Filter"}
          </Badge>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Kinds</option>
            <option value="pod">Pods</option>
            <option value="service">Services</option>
            <option value="database">Databases</option>
            <option value="vm">VMs</option>
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Components</option>
            {Object.keys(resourcesByComponent).map((component) => (
              <option key={component} value={component.toLowerCase()}>
                {component}
              </option>
            ))}
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="failed">Failed</option>
            <option value="updating">Updating</option>
          </select>
          <div className="flex rounded-md border border-neutral-800 bg-neutral-900">
            <button
              className={`px-3 py-1 ${selectedView === "grid" ? "bg-neutral-800" : "hover:bg-neutral-800/50"}`}
              onClick={() => setSelectedView("grid")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              className={`px-3 py-1 ${selectedView === "list" ? "bg-neutral-800" : "hover:bg-neutral-800/50"}`}
              onClick={() => setSelectedView("list")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Resource Content */}
      {selectedView === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((resource) => renderResourceCard(resource))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-neutral-800 hover:bg-transparent">
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Name
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Kind
                </TableHead>
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Component
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Provider
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Region
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Success Rate
                </TableHead>
                <TableHead className="w-1/6 font-medium text-neutral-400">
                  Last Updated
                </TableHead>
                <TableHead className="w-1/12 font-medium text-neutral-400">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((resource) => (
                <TableRow
                  key={resource.id}
                  className="border-b border-neutral-800/50 hover:bg-neutral-800/20"
                >
                  <TableCell className="py-3 font-medium text-neutral-200">
                    {resource.name}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.kind}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.component}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.provider}
                  </TableCell>
                  <TableCell className="py-3 text-neutral-300">
                    {resource.region}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${
                            resource.healthScore > 90
                              ? "bg-green-500"
                              : resource.healthScore > 70
                                ? "bg-amber-500"
                                : resource.healthScore > 0
                                  ? "bg-red-500"
                                  : "bg-neutral-600"
                          }`}
                          style={{ width: `${resource.healthScore}%` }}
                        />
                      </div>
                      <span className="text-sm">{resource.healthScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-neutral-400">
                    {resource.lastUpdated.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={
                        resource.status === "healthy"
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : resource.status === "degraded"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : resource.status === "failed"
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : resource.status === "updating"
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                : "border-neutral-500/30 bg-neutral-500/10 text-neutral-400"
                      }
                    >
                      {resource.status.charAt(0).toUpperCase() +
                        resource.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-neutral-400">
        <div>
          {filteredResources.length === resources.length ? (
            <>Showing all {resources.length} resources</>
          ) : (
            <>
              Showing {filteredResources.length} of {resources.length} resources
            </>
          )}
          {resourceFilter.conditions.length > 0 && (
            <>
              {" "}
              • <span className="text-blue-400">Filtered</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-neutral-800 px-3 py-1 transition-colors hover:bg-neutral-800/30">
            Previous
          </button>
          <button className="rounded-md border border-neutral-800 bg-neutral-800/40 px-3 py-1 transition-colors hover:bg-neutral-800/60">
            Next
          </button>
        </div>
      </div>

      {/* Resource Filter Editor Modal */}
      {showFilterEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[80vh] w-[800px] overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 p-4">
              <h3 className="text-lg font-medium text-neutral-100">
                Edit Resource Filter
              </h3>
              <button
                onClick={() => setShowFilterEditor(false)}
                className="text-neutral-400 hover:text-neutral-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Current Conditions */}
              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Current Filter Conditions
                </h4>

                {resourceFilter.conditions?.length > 0 ? (
                  <div className="space-y-2">
                    {resourceFilter.conditions.map(
                      (condition: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/30 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-blue-400">
                              {condition.type.charAt(0).toUpperCase() +
                                condition.type.slice(1)}
                            </span>
                            <span className="text-xs text-neutral-400">
                              equals
                            </span>
                            <span className="rounded bg-neutral-800 px-2 py-1 text-xs">
                              {condition.value}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newFilter = { ...resourceFilter };
                              newFilter.conditions =
                                resourceFilter.conditions.filter(
                                  (_: any, i: number) => i !== index,
                                );
                              setResourceFilter(newFilter);
                            }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-400">
                    No filter conditions set. Resources will not be filtered.
                  </div>
                )}
              </div>

              {/* Add New Condition */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Add New Condition</h4>

                <div className="grid grid-cols-12 gap-3">
                  {/* Condition Type */}
                  <div className="col-span-3">
                    <label className="mb-1 block text-xs text-neutral-400">
                      Condition Type
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      defaultValue="kind"
                      id="condition-type"
                    >
                      <option value="kind">Resource Kind</option>
                      <option value="provider">Provider</option>
                      <option value="status">Status</option>
                      <option value="component">Component</option>
                    </select>
                  </div>

                  {/* Operator - Static for now */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-neutral-400">
                      Operator
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      disabled
                    >
                      <option>equals</option>
                    </select>
                  </div>

                  {/* Condition Value */}
                  <div className="col-span-5">
                    <label className="mb-1 block text-xs text-neutral-400">
                      Value
                    </label>
                    <select
                      className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                      id="condition-value"
                    >
                      {/* Dynamically populate options based on condition type */}
                      <option value="">Select a value...</option>
                      <option value="Pod">Pod</option>
                      <option value="Service">Service</option>
                      <option value="Database">Database</option>
                      <option value="VM">VM</option>
                      <option value="kubernetes">kubernetes</option>
                      <option value="aws">aws</option>
                      <option value="gcp">gcp</option>
                      <option value="healthy">healthy</option>
                      <option value="degraded">degraded</option>
                      <option value="failed">failed</option>
                      <option value="updating">updating</option>
                      {Object.keys(resourcesByComponent).map((component) => (
                        <option key={component} value={component}>
                          {component}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Add Button */}
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-neutral-400">
                      &nbsp;
                    </label>
                    <button
                      className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      onClick={() => {
                        const typeSelect = document.getElementById(
                          "condition-type",
                        ) as HTMLSelectElement;
                        const valueSelect = document.getElementById(
                          "condition-value",
                        ) as HTMLSelectElement;

                        if (typeSelect && valueSelect && valueSelect.value) {
                          const newCondition = {
                            type: typeSelect.value,
                            operator: "equals",
                            not: false,
                            value: valueSelect.value,
                          };

                          const newFilter = { ...resourceFilter };
                          newFilter.conditions = [
                            ...resourceFilter.conditions,
                            newCondition,
                          ];
                          setResourceFilter(newFilter);
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Description of the filter effect */}
              <div className="rounded-md border border-neutral-800 bg-neutral-800/30 p-4">
                <h4 className="mb-2 text-sm font-medium">Filter Effect</h4>
                <p className="text-sm text-neutral-400">
                  This filter will{" "}
                  {resourceFilter.conditions.length > 0
                    ? "show only"
                    : "show all"}{" "}
                  resources
                  {resourceFilter.conditions.length > 0 && " that match"}
                  {resourceFilter.conditions.length > 1 &&
                    resourceFilter.operator === "and" &&
                    " all"}
                  {resourceFilter.conditions.length > 1 &&
                    resourceFilter.operator === "or" &&
                    " any"}
                  {resourceFilter.conditions.length > 0 &&
                    " of these conditions."}
                </p>
                {resourceFilter.conditions.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium text-blue-400">
                      Currently filtering:{" "}
                    </span>
                    {resourceFilter.conditions.map((c: any, i: number) => (
                      <span key={i} className="text-neutral-300">
                        {i > 0 && (
                          <span className="text-neutral-500">
                            {" "}
                            {resourceFilter.operator}{" "}
                          </span>
                        )}
                        {c.type} {c.operator} "{c.value}"
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Save and Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  className="rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
                  onClick={() => setShowFilterEditor(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => {
                    // In a real application, this would save the filter to the backend
                    // and then close the editor
                    setShowFilterEditor(false);
                  }}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// DeploymentsTabContent component for the Deployments tab
const DeploymentsTabContent: React.FC<{ environmentId: string }> = () => {
  const [selectedDeployment, setSelectedDeployment] = React.useState<any>(null);
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
                  {renderStatusBadge(deployment.status)}
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

export default function EnvironmentOverviewPage(props: {
  params: {
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  };
}) {
  // Sample static data
  const environmentData = {
    id: "env-123",
    name: "Production",
    directory: "prod",
    description: "Production environment for customer-facing applications",
    createdAt: new Date("2024-01-15"),
    metadata: [
      { key: "region", value: "us-west-2" },
      { key: "cluster", value: "main-cluster" },
      { key: "tier", value: "premium" },
    ],
    policy: {
      id: "pol-123",
      name: "Production Policy",
      approvalRequirement: "manual",
      successType: "all",
      successMinimum: 1,
      concurrencyLimit: 2,
      rolloutDuration: 1800000, // 30 minutes
      minimumReleaseInterval: 3600000, // 1 hour
      releaseWindows: [
        {
          recurrence: "daily",
          startTime: new Date("2023-01-01T10:00:00"),
          endTime: new Date("2023-01-01T16:00:00"),
        },
        {
          recurrence: "weekly",
          startTime: new Date("2023-01-01T09:00:00"),
          endTime: new Date("2023-01-01T17:00:00"),
        },
      ],
    },
  };

  const stats = {
    deployments: {
      total: 156,
      successful: 124,
      failed: 18,
      inProgress: 10,
      pending: 4,
    },
    resources: 42,
  };

  const deploymentSuccess = Math.round(
    (stats.deployments.successful / stats.deployments.total) * 100,
  );

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold text-neutral-100">
          {environmentData.name} Environment
        </h1>
        <p className="text-neutral-400">{environmentData.description}</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Environment Overview Card */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Environment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-neutral-400">Name</div>
                  <div className="text-neutral-100">{environmentData.name}</div>

                  <div className="text-neutral-400">Directory</div>
                  <div className="text-neutral-100">
                    {environmentData.directory}
                  </div>

                  <div className="text-neutral-400">Created</div>
                  <div className="text-neutral-100">
                    {environmentData.createdAt.toLocaleDateString()}
                  </div>
                </div>

                {environmentData.metadata.length > 0 && (
                  <>
                    <div className="my-4 h-px w-full bg-neutral-800"></div>
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-neutral-300">
                        Metadata
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {environmentData.metadata.map((meta, i) => (
                          <React.Fragment key={i}>
                            <div className="text-neutral-400">{meta.key}</div>
                            <div className="text-neutral-100">{meta.value}</div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Deployment Stats Card */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Deployment Statistics</CardTitle>
                <CardDescription>
                  Overview of deployment performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-3 flex justify-between">
                    <span className="text-sm font-medium text-neutral-300">
                      Success Rate
                    </span>
                    <span className="text-sm text-neutral-400">
                      {deploymentSuccess}%
                    </span>
                  </div>
                  <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                      style={{ width: `${deploymentSuccess}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="rounded-lg bg-neutral-800/50 p-3">
                    <div className="text-2xl font-semibold text-neutral-100">
                      {stats.deployments.total}
                    </div>
                    <div className="text-xs text-neutral-400">
                      Total Deployments
                    </div>
                  </div>
                  <div className="rounded-lg bg-neutral-800/50 p-3">
                    <div className="text-2xl font-semibold text-green-400">
                      {stats.deployments.successful}
                    </div>
                    <div className="text-xs text-neutral-400">Successful</div>
                  </div>
                  <div className="rounded-lg bg-neutral-800/50 p-3">
                    <div className="text-2xl font-semibold text-red-400">
                      {stats.deployments.failed}
                    </div>
                    <div className="text-xs text-neutral-400">Failed</div>
                  </div>
                  <div className="rounded-lg bg-neutral-800/50 p-3">
                    <div className="text-2xl font-semibold text-blue-400">
                      {stats.deployments.inProgress + stats.deployments.pending}
                    </div>
                    <div className="text-xs text-neutral-400">In Progress</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resources Card */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Resource Overview</CardTitle>
                <CardDescription>Currently managed resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[180px] items-center justify-center">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-neutral-100">
                      {stats.resources}
                    </div>
                    <div className="mt-2 text-sm text-neutral-400">
                      Total Resources
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-10">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Resource Telemetry</CardTitle>
                <CardDescription>
                  Real-time deployment status and version distribution across
                  environment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-neutral-800/40 bg-gradient-to-r from-purple-900/10 to-blue-900/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                      <span className="text-sm font-medium text-neutral-200">
                        Deployment Status
                      </span>
                    </div>
                    <span className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                      75% Complete
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                      style={{ width: "75%" }}
                    ></div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-neutral-400">
                    <span>Started 24 minutes ago</span>
                    <span>ETA: ~8 minutes</span>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-medium text-neutral-300">
                    Deployment Versions
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-neutral-800/50 bg-neutral-900/30">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800/70">
                          <th className="px-3 py-2 text-left font-medium text-neutral-400">
                            Component
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-neutral-400">
                            Current Distribution
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-neutral-400">
                            Desired Version
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-neutral-400">
                            Deployment Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-neutral-800/40">
                          <td className="px-3 py-2.5 font-medium text-neutral-300">
                            Database{" "}
                            <span className="text-[10px] text-neutral-400">
                              (9)
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: "78%" }}
                              ></div>
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: "22%" }}
                              ></div>
                            </div>
                            <div className="mt-1 flex text-[10px] text-neutral-400">
                              <div style={{ width: "78%" }}>v3.4.1</div>
                              <div style={{ width: "22%" }}>v3.3.0</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-300">
                            v3.4.1
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-green-400">
                                Deployed
                              </span>
                              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-neutral-800/40">
                          <td className="px-3 py-2.5 font-medium text-neutral-300">
                            API Server{" "}
                            <span className="text-[10px] text-neutral-400">
                              (12)
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: "83%" }}
                              ></div>
                              <div
                                className="h-full bg-red-500"
                                style={{ width: "17%" }}
                              ></div>
                            </div>
                            <div className="mt-1 flex text-[10px] text-neutral-400">
                              <div style={{ width: "83%" }}>v2.8.5</div>
                              <div style={{ width: "17%" }}>v2.7.0</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-300">
                            v3.0.0
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-amber-400">
                                Pending Approval
                              </span>
                              <span className="inline-block h-2 w-2 rounded-full bg-amber-400"></span>
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-neutral-800/40">
                          <td className="px-3 py-2.5 font-medium text-neutral-300">
                            Backend{" "}
                            <span className="text-[10px] text-neutral-400">
                              (7)
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: "100%" }}
                              ></div>
                            </div>
                            <div className="mt-1 flex text-[10px] text-neutral-400">
                              <div style={{ width: "100%" }}>v4.1.0</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-300">
                            v4.1.0
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-green-400">
                                Deployed
                              </span>
                              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-neutral-800/40">
                          <td className="px-3 py-2.5 font-medium text-neutral-300">
                            Frontend{" "}
                            <span className="text-[10px] text-neutral-400">
                              (5)
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: "60%" }}
                              ></div>
                              <div
                                className="h-full bg-purple-500"
                                style={{ width: "40%" }}
                              ></div>
                            </div>
                            <div className="mt-1 flex text-[10px] text-neutral-400">
                              <div style={{ width: "60%" }}>v2.0.0</div>
                              <div style={{ width: "40%" }}>v2.1.0-β</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-300">
                            v2.1.0
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-blue-400">
                                Deploying
                              </span>
                              <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-neutral-800/40">
                          <td className="px-3 py-2.5 font-medium text-neutral-300">
                            Cache{" "}
                            <span className="text-[10px] text-neutral-400">
                              (4)
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: "50%" }}
                              ></div>
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: "25%" }}
                              ></div>
                              <div
                                className="h-full bg-red-500"
                                style={{ width: "25%" }}
                              ></div>
                            </div>
                            <div className="mt-1 flex text-[10px] text-neutral-400">
                              <div style={{ width: "50%" }}>v1.9.2</div>
                              <div style={{ width: "25%" }}>v2.0.0</div>
                              <div style={{ width: "25%" }}>v1.8.0</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-300">
                            v2.0.0
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-red-400">
                                Failed
                              </span>
                              <span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2.5 font-medium text-neutral-300">
                            Monitoring{" "}
                            <span className="text-[10px] text-neutral-400">
                              (5)
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                              <div
                                className="h-full bg-green-500"
                                style={{ width: "80%" }}
                              ></div>
                              <div
                                className="h-full bg-amber-500"
                                style={{ width: "20%" }}
                              ></div>
                            </div>
                            <div className="mt-1 flex text-[10px] text-neutral-400">
                              <div style={{ width: "80%" }}>v3.0.1</div>
                              <div style={{ width: "20%" }}>v2.9.5</div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-300">
                            v3.0.1
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-green-400">
                                Deployed
                              </span>
                              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <CardTitle>Deployments</CardTitle>
              <CardDescription>
                View detailed deployment information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeploymentsTabContent environmentId={environmentData.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>
                Resources managed in this environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResourcesTabContent environmentId={environmentData.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <PoliciesTabContent environmentId={environmentData.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
