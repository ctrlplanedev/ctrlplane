import { formatDuration } from "date-fns";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

export const DeploymentDetail: React.FC<{
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
