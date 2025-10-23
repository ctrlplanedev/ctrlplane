import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Pause,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { CreateDeploymentDialog } from "./_components/CreateDeploymentDialog";

export function meta() {
  return [
    { title: "Deployments - Ctrlplane" },
    { name: "description", content: "Manage your deployments" },
  ];
}

// ctrlplane data model types based on OpenAPI spec
type DeploymentVersionStatus =
  | "unspecified"
  | "building"
  | "ready"
  | "failed"
  | "rejected";

// Mock deployment data aligned with ctrlplane
// Note: Every commit can be a release, deployments happen frequently (every few minutes for ephemeral envs)
type DeploymentWithMetrics = {
  id: string;
  name: string;
  systemId: string;
  systemName: string;
  description?: string;
  latestVersion?: {
    name: string;
    tag: string;
    status: DeploymentVersionStatus;
    createdAt: string;
  };
  activeReleases: number;
  totalResources: number;
  jobStatusSummary: {
    successful: number;
    inProgress: number;
    failed: number;
    pending: number;
    other: number;
  };
  recentActivity: {
    deploymentsLast24h: number;
    lastDeploymentTime: string;
  };
};

const mockDeployments: DeploymentWithMetrics[] = [
  {
    id: "1",
    name: "frontend-api",
    systemId: "sys-1",
    systemName: "E-commerce Platform",
    description: "Main frontend API service",
    latestVersion: {
      name: "Release 1.24.5",
      tag: "v1.24.5",
      status: "ready",
      createdAt: "2 minutes ago",
    },
    activeReleases: 12,
    totalResources: 15,
    jobStatusSummary: {
      successful: 12,
      inProgress: 0,
      failed: 0,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 48,
      lastDeploymentTime: "2 minutes ago",
    },
  },
  {
    id: "2",
    name: "user-service",
    systemId: "sys-1",
    systemName: "E-commerce Platform",
    description: "User authentication and management",
    latestVersion: {
      name: "Release 2.1.0",
      tag: "v2.1.0",
      status: "ready",
      createdAt: "5 minutes ago",
    },
    activeReleases: 8,
    totalResources: 10,
    jobStatusSummary: {
      successful: 5,
      inProgress: 3,
      failed: 0,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 32,
      lastDeploymentTime: "5 minutes ago",
    },
  },
  {
    id: "3",
    name: "payment-processor",
    systemId: "sys-2",
    systemName: "Payment System",
    description: "Process payments and transactions",
    latestVersion: {
      name: "Release 3.0.2",
      tag: "v3.0.2",
      status: "ready",
      createdAt: "1 minute ago",
    },
    activeReleases: 6,
    totalResources: 8,
    jobStatusSummary: {
      successful: 6,
      inProgress: 0,
      failed: 0,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 12,
      lastDeploymentTime: "1 minute ago",
    },
  },
  {
    id: "4",
    name: "notification-worker",
    systemId: "sys-3",
    systemName: "Notification System",
    description: "Background worker for notifications",
    latestVersion: {
      name: "Release 1.9.1",
      tag: "v1.9.1",
      status: "failed",
      createdAt: "15 minutes ago",
    },
    activeReleases: 4,
    totalResources: 5,
    jobStatusSummary: {
      successful: 1,
      inProgress: 0,
      failed: 3,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 8,
      lastDeploymentTime: "15 minutes ago",
    },
  },
  {
    id: "5",
    name: "analytics-engine",
    systemId: "sys-4",
    systemName: "Analytics Platform",
    description: "Data processing and analytics",
    latestVersion: {
      name: "Release 2.8.0",
      tag: "v2.8.0",
      status: "ready",
      createdAt: "3 minutes ago",
    },
    activeReleases: 10,
    totalResources: 12,
    jobStatusSummary: {
      successful: 10,
      inProgress: 0,
      failed: 0,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 24,
      lastDeploymentTime: "3 minutes ago",
    },
  },
  {
    id: "6",
    name: "cache-service",
    systemId: "sys-1",
    systemName: "E-commerce Platform",
    description: "Redis cache layer",
    latestVersion: {
      name: "Release 1.5.3",
      tag: "v1.5.3",
      status: "ready",
      createdAt: "1 hour ago",
    },
    activeReleases: 3,
    totalResources: 3,
    jobStatusSummary: {
      successful: 3,
      inProgress: 0,
      failed: 0,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 4,
      lastDeploymentTime: "1 hour ago",
    },
  },
  {
    id: "7",
    name: "search-indexer",
    systemId: "sys-1",
    systemName: "E-commerce Platform",
    description: "Elasticsearch indexing service",
    latestVersion: {
      name: "Release 4.2.1",
      tag: "v4.2.1",
      status: "building",
      createdAt: "8 minutes ago",
    },
    activeReleases: 5,
    totalResources: 7,
    jobStatusSummary: {
      successful: 3,
      inProgress: 2,
      failed: 0,
      pending: 2,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 156,
      lastDeploymentTime: "8 minutes ago",
    },
  },
  {
    id: "8",
    name: "auth-service",
    systemId: "sys-1",
    systemName: "E-commerce Platform",
    description: "OAuth and SSO service",
    latestVersion: {
      name: "Release 5.1.0",
      tag: "v5.1.0",
      status: "ready",
      createdAt: "4 minutes ago",
    },
    activeReleases: 9,
    totalResources: 11,
    jobStatusSummary: {
      successful: 9,
      inProgress: 0,
      failed: 0,
      pending: 0,
      other: 0,
    },
    recentActivity: {
      deploymentsLast24h: 18,
      lastDeploymentTime: "4 minutes ago",
    },
  },
];

// Helper functions for status styling based on ctrlplane statuses
const getVersionStatusColor = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "building":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "failed":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "rejected":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  }
};

const getVersionStatusIcon = (status: DeploymentVersionStatus) => {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="h-4 w-4" />;
    case "building":
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    case "failed":
      return <XCircle className="h-4 w-4" />;
    case "rejected":
      return <Pause className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

// Calculate overall health based on job statuses
const getDeploymentHealth = (
  jobSummary: DeploymentWithMetrics["jobStatusSummary"],
) => {
  const total = Object.values(jobSummary).reduce((a, b) => a + b, 0);
  if (total === 0)
    return {
      status: "Unknown",
      color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };

  if (jobSummary.failed > 0) {
    return {
      status: "Degraded",
      color: "bg-red-500/10 text-red-600 border-red-500/20",
    };
  }
  if (jobSummary.inProgress > 0 || jobSummary.pending > 0) {
    return {
      status: "Progressing",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    };
  }
  if (jobSummary.successful === total) {
    return {
      status: "Healthy",
      color: "bg-green-500/10 text-green-600 border-green-500/20",
    };
  }
  return {
    status: "Unknown",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };
};

export default function Deployments() {
  const { workspaceSlug } = useParams();
  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [systemFilter, setSystemFilter] = useState<string>("all");

  // Get unique systems for filter
  const systems = Array.from(new Set(mockDeployments.map((d) => d.systemName)));

  // Filter deployments
  const filteredDeployments = mockDeployments.filter((deployment) => {
    const matchesSearch =
      deployment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deployment.systemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deployment.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const health = getDeploymentHealth(deployment.jobStatusSummary);
    const matchesStatus =
      statusFilter === "all" || health.status === statusFilter;
    const matchesSystem =
      systemFilter === "all" || deployment.systemName === systemFilter;

    return matchesSearch && matchesStatus && matchesSystem;
  });

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Deployments</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateDeploymentDialog>
          <Button>Create Deployment</Button>
        </CreateDeploymentDialog>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Filters and Search */}

        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deployments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={systemFilter} onValueChange={setSystemFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="System" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Systems</SelectItem>
                  {systems.map((system) => (
                    <SelectItem key={system} value={system}>
                      {system}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Healthy">Healthy</SelectItem>
                  <SelectItem value="Progressing">Progressing</SelectItem>
                  <SelectItem value="Degraded">Degraded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Deployments Grid/List */}
        <div
          className={"grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}
        >
          {filteredDeployments.map((deployment) => {
            const health = getDeploymentHealth(deployment.jobStatusSummary);
            return (
              <Link
                key={deployment.id}
                to={`/${workspaceSlug}/deployments/${deployment.id}`}
              >
                <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <CardTitle className="text-base font-semibold transition-colors group-hover:text-primary">
                          {deployment.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {deployment.systemName}
                        </CardDescription>
                      </div>
                    </div>
                    {deployment.description && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {deployment.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={health.color}>
                        {health.status === "Healthy" && (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {health.status === "Progressing" && (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {health.status === "Degraded" && (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span className="ml-1">{health.status}</span>
                      </Badge>
                      {deployment.latestVersion && (
                        <Badge
                          className={getVersionStatusColor(
                            deployment.latestVersion.status,
                          )}
                        >
                          {getVersionStatusIcon(
                            deployment.latestVersion.status,
                          )}
                          <span className="ml-1 capitalize">
                            {deployment.latestVersion.status}
                          </span>
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      {deployment.latestVersion && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Latest Version
                            </span>
                            <span className="font-mono text-xs">
                              {deployment.latestVersion.tag}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Created
                            </span>
                            <span className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {deployment.latestVersion.createdAt}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Releases (24h)
                        </span>
                        <span className="font-medium">
                          {deployment.recentActivity.deploymentsLast24h}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Active</span>
                        <span className="font-medium">
                          {deployment.activeReleases}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Resources</span>
                        <span className="font-medium">
                          {deployment.totalResources}
                        </span>
                      </div>
                    </div>

                    {/* Job Status Summary */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Job Status
                      </div>
                      <div className="flex gap-1">
                        {deployment.jobStatusSummary.successful > 0 && (
                          <div
                            className="h-2 flex-1 rounded-sm bg-green-500"
                            style={{
                              flexGrow: deployment.jobStatusSummary.successful,
                            }}
                            title={`${deployment.jobStatusSummary.successful} successful`}
                          />
                        )}
                        {deployment.jobStatusSummary.inProgress > 0 && (
                          <div
                            className="h-2 flex-1 rounded-sm bg-blue-500"
                            style={{
                              flexGrow: deployment.jobStatusSummary.inProgress,
                            }}
                            title={`${deployment.jobStatusSummary.inProgress} in progress`}
                          />
                        )}
                        {deployment.jobStatusSummary.pending > 0 && (
                          <div
                            className="h-2 flex-1 rounded-sm bg-amber-500"
                            style={{
                              flexGrow: deployment.jobStatusSummary.pending,
                            }}
                            title={`${deployment.jobStatusSummary.pending} pending`}
                          />
                        )}
                        {deployment.jobStatusSummary.failed > 0 && (
                          <div
                            className="h-2 flex-1 rounded-sm bg-red-500"
                            style={{
                              flexGrow: deployment.jobStatusSummary.failed,
                            }}
                            title={`${deployment.jobStatusSummary.failed} failed`}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {deployment.jobStatusSummary.successful > 0 && (
                          <span>
                            {deployment.jobStatusSummary.successful} ✓
                          </span>
                        )}
                        {deployment.jobStatusSummary.inProgress > 0 && (
                          <span>
                            {deployment.jobStatusSummary.inProgress} ⟳
                          </span>
                        )}
                        {deployment.jobStatusSummary.pending > 0 && (
                          <span>{deployment.jobStatusSummary.pending} ⋯</span>
                        )}
                        {deployment.jobStatusSummary.failed > 0 && (
                          <span>{deployment.jobStatusSummary.failed} ✗</span>
                        )}
                      </div>
                    </div>

                    <Button variant="outline" className="w-full" size="sm">
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {filteredDeployments.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No deployments found
              </h3>
              <p className="text-center text-sm text-muted-foreground">
                Try adjusting your search or filter criteria
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
