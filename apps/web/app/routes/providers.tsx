import { useState } from "react";
import _ from "lodash";
import {
  Cloud,
  Database,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export function meta() {
  return [
    { title: "Providers - Ctrlplane" },
    {
      name: "description",
      content: "Manage your resource providers",
    },
  ];
}

type ProviderType =
  | "aws"
  | "google"
  | "azure"
  | "kubernetes"
  | "terraform"
  | "salesforce"
  | "github"
  | "custom";

type Provider = {
  id: string;
  name: string;
  type: ProviderType;
  resourceCount: number;
  kinds: string[];
  lastSyncedAt: string | null;
  status: "active" | "syncing" | "error" | "idle";
  metadata?: Record<string, string>;
};

// Mock data representing different types of providers
const mockProviders: Provider[] = [
  {
    id: "1",
    name: "AWS Production",
    type: "aws",
    resourceCount: 342,
    kinds: ["EC2", "RDS", "S3", "Lambda", "ECS"],
    lastSyncedAt: "2025-10-20T10:30:00",
    status: "active",
    metadata: {
      region: "us-east-1",
      accountId: "123456789012",
    },
  },
  {
    id: "2",
    name: "Google Cloud Platform",
    type: "google",
    resourceCount: 156,
    kinds: ["Compute Engine", "Cloud Storage", "Cloud SQL", "GKE"],
    lastSyncedAt: "2025-10-20T09:15:00",
    status: "active",
    metadata: {
      projectId: "ctrlplane-prod",
    },
  },
  {
    id: "3",
    name: "Production Kubernetes Cluster",
    type: "kubernetes",
    resourceCount: 89,
    kinds: ["Pod", "Deployment", "Service", "ConfigMap", "Secret"],
    lastSyncedAt: "2025-10-20T10:45:00",
    status: "syncing",
    metadata: {
      cluster: "prod-k8s-01",
      namespace: "all",
    },
  },
  {
    id: "4",
    name: "Azure Staging",
    type: "azure",
    resourceCount: 67,
    kinds: [
      "Virtual Machine",
      "Storage Account",
      "SQL Database",
      "App Service",
    ],
    lastSyncedAt: "2025-10-19T16:20:00",
    status: "active",
    metadata: {
      subscriptionId: "abc-def-ghi",
      resourceGroup: "staging",
    },
  },
  {
    id: "5",
    name: "Terraform Cloud",
    type: "terraform",
    resourceCount: 234,
    kinds: ["Workspace", "State", "Module"],
    lastSyncedAt: "2025-10-20T08:00:00",
    status: "active",
    metadata: {
      organization: "acme-corp",
    },
  },
  {
    id: "6",
    name: "Salesforce Production",
    type: "salesforce",
    resourceCount: 45,
    kinds: ["Account", "Contact", "Opportunity", "Lead"],
    lastSyncedAt: "2025-10-20T07:30:00",
    status: "active",
    metadata: {
      instanceUrl: "https://acme.salesforce.com",
    },
  },
  {
    id: "7",
    name: "GitHub Organization",
    type: "github",
    resourceCount: 128,
    kinds: ["Repository", "Team", "Action", "Environment"],
    lastSyncedAt: null,
    status: "idle",
    metadata: {
      org: "acme-corp",
    },
  },
  {
    id: "8",
    name: "Custom API Provider",
    type: "custom",
    resourceCount: 23,
    kinds: ["CustomResource"],
    lastSyncedAt: "2025-10-18T14:00:00",
    status: "error",
    metadata: {},
  },
];

export default function Providers() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProviders = mockProviders.filter(
    (provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.kinds.some((kind) =>
        kind.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  const getProviderTypeColor = (type: ProviderType) => {
    switch (type) {
      case "aws":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20";
      case "google":
        return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "azure":
        return "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20";
      case "kubernetes":
        return "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20";
      case "terraform":
        return "bg-violet-500/10 text-violet-500 hover:bg-violet-500/20";
      case "salesforce":
        return "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20";
      case "github":
        return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
      case "custom":
        return "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20";
      default:
        return "";
    }
  };

  const getStatusColor = (status: Provider["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "syncing":
        return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
      case "idle":
        return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
      default:
        return "";
    }
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const groupByType = _.groupBy(filteredProviders, (m) => m.type);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Providers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex min-w-[350px] items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {filteredProviders.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <Cloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No providers found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by adding your first provider"}
                </p>
              </div>
              {!searchQuery && (
                <Button className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Provider
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-muted-foreground">
                  Provider
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Resources
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Resource Kinds
                </TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">
                  Last Synced
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupByType).map(([type, providers]) => (
                <>
                  <TableRow
                    key={`header-${type}`}
                    className="bg-muted/30 text-xs hover:bg-muted/30"
                  >
                    <TableCell colSpan={6} className="py-2">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={getProviderTypeColor(type as ProviderType)}
                        >
                          {type.toUpperCase()}
                        </Badge>
                        <span className="text-muted-foreground">
                          {providers.length} provider
                          {providers.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground">
                          {providers.reduce(
                            (sum, p) => sum + p.resourceCount,
                            0,
                          )}{" "}
                          resources
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {providers.map((provider) => (
                    <TableRow key={provider.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            {provider.type === "kubernetes" ? (
                              <Database className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Cloud className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{provider.name}</div>
                            {provider.metadata &&
                              Object.keys(provider.metadata).length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {Object.entries(provider.metadata)[0][0]}:{" "}
                                  {Object.entries(provider.metadata)[0][1]}
                                </div>
                              )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {provider.resourceCount}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            resources
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {provider.kinds.slice(0, 3).map((kind) => (
                            <Badge
                              key={kind}
                              variant="outline"
                              className="text-xs"
                            >
                              {kind}
                            </Badge>
                          ))}
                          {provider.kinds.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{provider.kinds.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(provider.status)}
                        >
                          {provider.status === "syncing" && (
                            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          {provider.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(provider.lastSyncedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
