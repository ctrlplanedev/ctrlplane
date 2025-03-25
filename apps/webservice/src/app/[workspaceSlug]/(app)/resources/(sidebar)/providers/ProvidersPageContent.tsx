"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiAmazon, SiGooglecloud } from "@icons-pack/react-simple-icons";
import {
  IconBrandAzure,
  IconDeviceDesktopAnalytics,
  IconExternalLink,
  IconFilter,
  IconKeyboard,
  IconLayoutGrid,
  IconLayoutList,
  IconMenu2,
  IconSearch,
  IconServer,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from "@tabler/icons-react";
import LZString from "lz-string";

import { cn } from "@ctrlplane/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { urls } from "~/app/urls";
import { ProviderStatisticsCard } from "./_components/ProviderStatisticsCard";
import { ProviderActionsDropdown } from "./ProviderActionsDropdown";
import { ProviderCard } from "./ProviderCard";
import { ResourceProvidersGettingStarted } from "./ResourceProvidersGettingStarted";

// No explicit provider types, so we identify providers based on their configs

// Providers are identified by their configuration (awsConfig, googleConfig, azureConfig)
// rather than explicit types

// Get status icon/color based on sync status
const getSyncStatusDetails = (status: string) => {
  switch (status) {
    case "success":
      return {
        color: "text-green-400",
        bgColor: "bg-green-400",
        statusText: "Healthy",
      };
    case "warning":
      return {
        color: "text-yellow-400",
        bgColor: "bg-yellow-400",
        statusText: "Warning",
      };
    case "error":
      return {
        color: "text-red-400",
        bgColor: "bg-red-400",
        statusText: "Error",
      };
    default:
      return {
        color: "text-neutral-400",
        bgColor: "bg-neutral-400",
        statusText: "Unknown",
      };
  }
};

export const ProviderPageContent: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "resourceCount" | "syncStatus" | "createdAt"
  >("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"grid" | "compact">("grid");
  const [filterType, setFilterType] = useState<
    "all" | "aws" | "google" | "azure" | "custom"
  >("all");
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "/":
          // Focus search input
          e.preventDefault();
          document.getElementById("provider-search")?.focus();
          break;
        case "g":
          // Toggle grid/compact view
          setViewMode((v) => (v === "grid" ? "compact" : "grid"));
          break;
        case "s":
          // Toggle sort direction
          setSortDirection((s) => (s === "asc" ? "desc" : "asc"));
          break;
        case "c":
          // Clear filters
          setSearchTerm("");
          setFilterType("all");
          break;
        case "1":
          setFilterType("all");
          break;
        case "2":
          setFilterType("aws");
          break;
        case "3":
          setFilterType("google");
          break;
        case "4":
          setFilterType("azure");
          break;
        case "5":
          setFilterType("custom");
          break;
        case "?":
          // Show keyboard shortcuts
          setShowKeyboardShortcuts(true);
          break;
        case "Escape":
          // Close keyboard shortcuts
          setShowKeyboardShortcuts(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Function to generate random trend data
  const generateTrendData = (points = 7, base = 50, variance = 20) => {
    return Array.from({ length: points }, (_, i) => ({
      name: `Day ${i + 1}`,
      value: Math.max(
        5,
        Math.floor(base + Math.random() * variance * 2 - variance),
      ),
    }));
  };

  // Static data for visualization
  const mockProviders = [
    {
      id: "aws-123456",
      name: "AWS Production",
      awsConfig: { region: "us-west-2" },
      googleConfig: null,
      azureConfig: null,
      resourceCount: 183,
      trendData: generateTrendData(7, 160, 30),
      kinds: [
        { version: "v1", kind: "EC2Instance" },
        { version: "v1", kind: "RDSDatabase" },
        { version: "v1", kind: "S3Bucket" },
        { version: "v1", kind: "DynamoDB" },
        { version: "v1", kind: "ElasticCache" },
        { version: "v1", kind: "EKSCluster" },
        { version: "v1", kind: "LambdaFunction" },
      ],
      lastSyncTime: "3 minutes ago",
      syncStatus: "success",
      createdAt: new Date("2024-01-15").toISOString(),
    },
    {
      id: "gcp-789012",
      name: "GCP Backend",
      awsConfig: null,
      googleConfig: { projectId: "backend-services" },
      azureConfig: null,
      resourceCount: 124,
      trendData: generateTrendData(7, 100, 25),
      kinds: [
        { version: "v1", kind: "GKECluster" },
        { version: "v1", kind: "CloudSQL" },
        { version: "v1", kind: "CloudStorage" },
        { version: "v1", kind: "ComputeInstance" },
      ],
      lastSyncTime: "15 minutes ago",
      syncStatus: "success",
      createdAt: new Date("2024-02-03").toISOString(),
    },
    {
      id: "azure-345678",
      name: "Azure Platform",
      awsConfig: null,
      googleConfig: null,
      azureConfig: { subscriptionId: "platform-12345" },
      resourceCount: 97,
      trendData: generateTrendData(7, 80, 20),
      kinds: [
        { version: "v1", kind: "AKSCluster" },
        { version: "v1", kind: "CosmosDB" },
        { version: "v1", kind: "StorageAccount" },
        { version: "v1", kind: "AppService" },
        { version: "v1", kind: "FunctionApp" },
      ],
      lastSyncTime: "8 minutes ago",
      syncStatus: "warning",
      createdAt: new Date("2024-01-28").toISOString(),
    },
    {
      id: "aws-234567",
      name: "AWS Staging",
      awsConfig: { region: "us-east-1" },
      googleConfig: null,
      azureConfig: null,
      resourceCount: 76,
      trendData: generateTrendData(7, 70, 15),
      kinds: [
        { version: "aws/v1", kind: "EC2Instance" },
        { version: "aws/v1", kind: "RDSDatabase" },
        { version: "aws/v1", kind: "S3Bucket" },
      ],
      lastSyncTime: "5 minutes ago",
      syncStatus: "success",
      createdAt: new Date("2024-02-15").toISOString(),
    },
    {
      id: "custom-123",
      name: "On-Premise Data Center",
      awsConfig: null,
      googleConfig: null,
      azureConfig: null,
      resourceCount: 42,
      trendData: generateTrendData(7, 40, 10),
      kinds: [
        { version: "v1", kind: "VMServer" },
        { version: "v1", kind: "Database" },
        { version: "v1", kind: "StorageVolume" },
      ],
      lastSyncTime: "1 hour ago",
      syncStatus: "success",
      createdAt: new Date("2024-03-01").toISOString(),
    },
    {
      id: "custom-456",
      name: "Legacy System",
      awsConfig: null,
      googleConfig: null,
      azureConfig: null,
      resourceCount: 28,
      trendData: generateTrendData(7, 30, 10),
      kinds: [
        { version: "v1", kind: "Database" },
        { version: "v1", kind: "Storage" },
        { version: "v1", kind: "ComputeService" },
      ],
      lastSyncTime: "30 minutes ago",
      syncStatus: "error",
      createdAt: new Date("2024-02-18").toISOString(),
    },
    {
      id: "salesforce-123",
      name: "Salesforce CRM",
      awsConfig: null,
      googleConfig: null,
      azureConfig: null,
      resourceCount: 210,
      trendData: generateTrendData(7, 190, 35),
      kinds: [
        { version: "v1", kind: "Contact" },
        { version: "v1", kind: "Account" },
        { version: "v1", kind: "Opportunity" },
        { version: "v1", kind: "Campaign" },
      ],
      lastSyncTime: "25 minutes ago",
      syncStatus: "success",
      createdAt: new Date("2024-01-10").toISOString(),
    },
    {
      id: "hubspot-456",
      name: "HubSpot Marketing",
      awsConfig: null,
      googleConfig: null,
      azureConfig: null,
      resourceCount: 125,
      trendData: generateTrendData(7, 110, 25),
      kinds: [
        { version: "v1", kind: "Contact" },
        { version: "v1", kind: "Campaign" },
        { version: "v1", kind: "EmailTemplate" },
      ],
      lastSyncTime: "1 hour ago",
      syncStatus: "success",
      createdAt: new Date("2024-02-05").toISOString(),
    },
    {
      id: "gcp-123456",
      name: "GCP Analytics",
      awsConfig: null,
      googleConfig: { projectId: "data-analytics" },
      azureConfig: null,
      resourceCount: 53,
      trendData: generateTrendData(7, 50, 15),
      kinds: [
        { version: "v1", kind: "GKECluster" },
        { version: "v1", kind: "BigQueryTable" },
        { version: "v1", kind: "DataflowJob" },
        { version: "v1", kind: "CloudStorage" },
      ],
      lastSyncTime: "45 minutes ago",
      syncStatus: "success",
      createdAt: new Date("2024-02-20").toISOString(),
    },
    {
      id: "snowflake-789",
      name: "Snowflake Data Warehouse",
      awsConfig: null,
      googleConfig: null,
      azureConfig: null,
      resourceCount: 89,
      trendData: generateTrendData(7, 75, 20),
      kinds: [
        { version: "v1", kind: "Database" },
        { version: "v1", kind: "Schema" },
        { version: "v1", kind: "Table" },
        { version: "v1", kind: "View" },
      ],
      lastSyncTime: "2 hours ago",
      syncStatus: "warning",
      createdAt: new Date("2024-01-25").toISOString(),
    },
  ];

  const resourceProviders = mockProviders;

  // Apply filters and sort to providers
  const filteredAndSortedProviders = useMemo(() => {
    const result = resourceProviders
      // Add filterLink to each provider
      .map((provider) => {
        const filter: ResourceCondition = {
          type: ResourceFilterType.Provider,
          value: provider.id,
          operator: "equals",
        };
        const hash = LZString.compressToEncodedURIComponent(
          JSON.stringify(filter),
        );
        const filterLink = `/${workspace.slug}/resources/list?filter=${hash}`;
        return { ...provider, filterLink };
      })
      // Apply search term filter
      .filter((provider) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          provider.name.toLowerCase().includes(searchLower) ||
          provider.kinds.some((k) => k.kind.toLowerCase().includes(searchLower))
        );
      })
      // Apply provider type filter
      .filter((provider) => {
        if (filterType === "all") return true;
        if (filterType === "aws") return provider.awsConfig !== null;
        if (filterType === "google") return provider.googleConfig !== null;
        if (filterType === "azure") return provider.azureConfig !== null;
        if (filterType === "custom")
          return (
            !provider.awsConfig &&
            !provider.googleConfig &&
            !provider.azureConfig
          );
        return true;
      });

    // Sort the filtered results
    result.sort((a, b) => {
      let valueA, valueB;

      // Extract the values to compare based on the sort field
      switch (sortBy) {
        case "name":
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case "resourceCount":
          valueA = a.resourceCount;
          valueB = b.resourceCount;
          break;
        case "syncStatus":
          valueA = a.syncStatus;
          valueB = b.syncStatus;
          break;
        case "createdAt":
          valueA = new Date(a.createdAt).getTime();
          valueB = new Date(b.createdAt).getTime();
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }

      // Determine sort direction
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });

    return result;
  }, [
    resourceProviders,
    searchTerm,
    sortBy,
    sortDirection,
    filterType,
    workspace,
  ]);

  const providers = filteredAndSortedProviders;

  const integrationsUrl = urls
    .workspace(workspace.slug)
    .resources()
    .providers()
    .integrations()
    .baseUrl();

  // Data for the statistics card
  const totalResources = providers.reduce(
    (sum, provider) => sum + provider.resourceCount,
    0,
  );
  const totalProviders = providers.length;

  // Get the most common resource kinds across all providers
  const allKinds = providers
    .flatMap((p) => p.kinds)
    .map((k) => `${k.version}:${k.kind}`);
  const kindCount = allKinds.reduce(
    (acc, kind) => {
      acc[kind] = (acc[kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topKinds = Object.entries(kindCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Additional static data for visualization
  // Note: We avoid categorizing providers since they don't have explicit types

  // Count cloud provider configs
  const providerConfigs = {
    aws: providers.filter((p) => p.awsConfig != null).length,
    google: providers.filter((p) => p.googleConfig != null).length,
    azure: providers.filter((p) => p.azureConfig != null).length,
    custom: providers.filter(
      (p) =>
        p.googleConfig == null && p.awsConfig == null && p.azureConfig == null,
    ).length,
  };

  // Get all resource versions across all providers
  const allResources = providers.flatMap((p) => p.kinds);

  // Group resources by version
  const resourceVersionGroups = allResources.reduce(
    (acc, resource) => {
      // Use only version part (e.g., v1, aws/v1)
      const version = resource.version;
      if (!acc[version]) {
        acc[version] = [];
      }
      acc[version].push(resource);
      return acc;
    },
    {} as Record<string, any[]>,
  );

  // Count resources by version
  const resourceVersionCounts = Object.entries(resourceVersionGroups).map(
    ([version, resources]) => [version, resources.length],
  );

  // Sort versions by count (descending)
  const sortedVersionCounts = resourceVersionCounts.sort(
    (a, b) => (b[1] as number) - (a[1] as number),
  );

  // Get top versions (up to 5)
  const topResourceVersions = sortedVersionCounts.slice(0, 5);

  // Calculate total for top versions
  const topVersionsTotal = topResourceVersions.reduce(
    (sum, [_, count]) => sum + (count as number),
    0,
  );

  // Calculate "other" category if there are more versions
  const otherVersionsCount =
    sortedVersionCounts.length > 5 ? allResources.length - topVersionsTotal : 0;

  // Combine top versions with "other" category
  const resourceVersionDistribution = [
    ...topResourceVersions,
    ...(otherVersionsCount > 0 ? [["Other versions", otherVersionsCount]] : []),
  ];

  // Calculate percentages for visualization
  const resourceVersionPercentages = resourceVersionDistribution.map(
    ([version, count], index) => ({
      version: version as string,
      count: count as number,
      percentage:
        Math.round(((count as number) / allResources.length) * 100) || 0,
      color: [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-amber-500",
        "bg-red-500",
        "bg-neutral-500",
      ][index],
    }),
  );

  // Get common resources for each version
  const commonResourcesByVersion = Object.entries(resourceVersionGroups).reduce(
    (acc, [version, resources]) => {
      // Count kinds for this version
      const kindCounts = resources.reduce(
        (counts, resource) => {
          const kind = resource.kind;
          counts[kind] = (counts[kind] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      );

      // Get top kinds for this version
      const topKinds = Object.entries(kindCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kind, _]) => kind);

      acc[version] = topKinds;
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const healthStats = {
    healthy: Math.round(totalResources * 0.92),
    warning: 5,
    critical: 3,
    syncTime: "3 minutes ago",
    recentIssues: [
      { type: "warning", message: "Quota warning (AWS-EC2)", time: "2h ago" },
      { type: "critical", message: "Auth failure (GCP)", time: "1d ago" },
      { type: "warning", message: "Sync delay (Salesforce)", time: "30m ago" },
      {
        type: "critical",
        message: "Connection failure (Legacy System)",
        time: "1h ago",
      },
    ],
  };

  // Sync status data
  const syncStatusStats = {
    success: providers.filter((p) => p.syncStatus === "success").length,
    warning: providers.filter((p) => p.syncStatus === "warning").length,
    error: providers.filter((p) => p.syncStatus === "error").length,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Keyboard shortcuts dialog */}
      <Dialog
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconKeyboard className="h-5 w-5 text-blue-400" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to quickly navigate and filter providers
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-200">
                Navigation
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Search</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    /
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Toggle view</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    g
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Toggle sort</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    s
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Clear filters</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    c
                  </kbd>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-200">
                Filter by Type
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">All providers</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    1
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">AWS</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    2
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Google Cloud</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    3
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Azure</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    4
                  </kbd>
                </div>
                <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                  <span className="text-neutral-400">Custom</span>
                  <kbd className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                    5
                  </kbd>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PageHeader className="z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Resources}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage>Providers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  className="h-8 w-8"
                >
                  <IconKeyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard shortcuts (Press ?)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5",
            )}
            href={integrationsUrl}
          >
            Add Provider
          </Link>
        </div>
      </PageHeader>

      {resourceProviders.length === 0 && <ResourceProvidersGettingStarted />}
      {resourceProviders.length > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Insights Section */}
            <div className="col-span-3">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-neutral-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400">
                  <IconDeviceDesktopAnalytics className="h-5 w-5" />
                </span>
                Insights
              </h2>
            </div>

            {/* Provider Statistics Card */}
            <ProviderStatisticsCard workspaceId={workspace.id} />

            {/* Resource Distribution Card */}
            <Card className="col-span-1 flex flex-col bg-neutral-900/50 shadow-md transition duration-200 hover:shadow-lg">
              <CardHeader className="pb-2">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-400">
                  <IconExternalLink className="h-4 w-4 text-purple-400" />
                  Resource Distribution
                </div>
                <CardTitle className="text-lg">Resources</CardTitle>
                <CardDescription>Distribution by API version</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-grow flex-col space-y-4">
                <div>
                  <div className="mb-3 flex justify-between">
                    <span className="text-sm font-medium text-neutral-300">
                      API Versions
                    </span>
                    <span className="text-xs text-neutral-400">
                      {Object.keys(resourceVersionGroups).length} versions total
                    </span>
                  </div>
                  <div className="mb-4 h-4 w-full overflow-hidden rounded-full bg-neutral-800">
                    <div className="flex h-full w-full">
                      {resourceVersionPercentages.map((item) => (
                        <div
                          key={item.version}
                          className={`h-full ${item.color}`}
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-400">
                    {resourceVersionPercentages.map((item) => (
                      <div
                        key={item.version}
                        className="flex items-center gap-1"
                      >
                        <div
                          className={`h-2 w-2 rounded-full ${item.color}`}
                        ></div>
                        <span className="truncate">
                          {item.version} ({item.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <h4 className="text-sm font-medium text-neutral-300">
                    Top API Versions
                  </h4>
                  {resourceVersionPercentages.slice(0, 4).map((item) => (
                    <div key={item.version}>
                      <div className="mb-1 flex justify-between">
                        <span className="max-w-[75%] truncate text-sm text-neutral-300">
                          {item.version}
                        </span>
                        <span className="text-sm text-neutral-400">
                          {item.count} resources
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {commonResourcesByVersion[item.version]?.map((kind) => (
                          <span
                            key={`${item.version}-${kind}`}
                            className="rounded-sm bg-neutral-800/70 px-1.5 py-0.5 text-xs text-neutral-500"
                          >
                            {kind}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                  <h4 className="mb-3 text-sm font-medium text-neutral-200">
                    Version Details
                  </h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Total resources</span>
                      <span className="text-neutral-400">
                        {allResources.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">
                        Unique API versions
                      </span>
                      <span className="text-neutral-400">
                        {Object.keys(resourceVersionGroups).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">
                        Resources per version
                      </span>
                      <span className="text-neutral-400">
                        {Object.keys(resourceVersionGroups).length > 0
                          ? Math.round(
                              allResources.length /
                                Object.keys(resourceVersionGroups).length,
                            )
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">
                        Most common version
                      </span>
                      <span className="text-neutral-400">
                        {topResourceVersions.length > 0 &&
                        topResourceVersions[0]
                          ? (topResourceVersions[0][0]?.toString() ?? "None")
                          : "None"}
                      </span>
                    </div>
                    {Object.keys(resourceVersionGroups).length > 5 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-300">Other versions</span>
                        <span className="text-neutral-400">
                          {Object.keys(resourceVersionGroups).length - 5}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sync Status Card */}
            <Card className="col-span-1 flex flex-col bg-neutral-900/50 shadow-md transition duration-200 hover:shadow-lg">
              <CardHeader className="pb-2">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-400">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  Sync Status
                </div>
                <CardTitle className="text-lg">Health</CardTitle>
                <CardDescription>Provider connectivity status</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-grow flex-col space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 shadow-inner">
                    <div className="text-2xl font-semibold text-green-400">
                      {syncStatusStats.success}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-xs text-neutral-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                      Healthy
                    </div>
                  </div>
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 shadow-inner">
                    <div className="text-2xl font-semibold text-yellow-400">
                      {syncStatusStats.warning}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-xs text-neutral-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-yellow-500"></div>
                      Warning
                    </div>
                  </div>
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 shadow-inner">
                    <div className="text-2xl font-semibold text-red-400">
                      {syncStatusStats.error}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-xs text-neutral-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
                      Error
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-800/40 bg-gradient-to-r from-purple-900/10 to-blue-900/10 p-4">
                  <div className="mb-2">
                    <h5 className="text-sm font-medium text-neutral-200">
                      Resource Syncing
                    </h5>
                    <p className="text-xs text-neutral-400">
                      Last sync completed {healthStats.syncTime}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-xs text-neutral-300">
                        Auto-sync enabled
                      </span>
                    </div>
                    <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-medium text-green-400">
                      Healthy
                    </span>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                  <h5 className="text-sm font-medium text-neutral-200">
                    Recent Issues
                  </h5>
                  <div className="max-h-[120px] space-y-2 overflow-y-auto pr-1 text-xs">
                    {healthStats.recentIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${issue.type === "warning" ? "bg-yellow-500" : "bg-red-500"}`}
                          ></div>
                          <span className="text-neutral-300">
                            {issue.message}
                          </span>
                        </div>
                        <span className="text-neutral-400">{issue.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Providers Section */}
            <div className="col-span-3 mt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-green-500/20 to-blue-500/20 text-green-400">
                    <IconServer className="h-5 w-5" />
                  </span>
                  Providers
                  <span className="ml-2 rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-400">
                    {providers.length} of {resourceProviders.length}
                  </span>
                </h2>
                <div className="flex flex-1 items-center justify-end gap-3">
                  <div className="relative max-w-xs flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <IconSearch className="h-4 w-4 text-neutral-400" />
                    </div>
                    <input
                      id="provider-search"
                      type="text"
                      placeholder="Search providers... (Press / to focus)"
                      className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 pl-9 pr-8 text-sm text-neutral-200 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute inset-y-0 right-3 flex items-center"
                      >
                        <IconX className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-200" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-hidden rounded-md border border-neutral-700 bg-neutral-800">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-1.5 transition",
                        viewMode === "grid"
                          ? "bg-neutral-700 text-neutral-100"
                          : "hover:bg-neutral-750 text-neutral-400",
                      )}
                    >
                      <IconLayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("compact")}
                      className={cn(
                        "p-1.5 transition",
                        viewMode === "compact"
                          ? "bg-neutral-700 text-neutral-100"
                          : "hover:bg-neutral-750 text-neutral-400",
                      )}
                    >
                      <IconLayoutList className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter & Sort Controls */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-neutral-400">
                    <IconFilter className="h-3.5 w-3.5" /> Filter:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setFilterType("all")}
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium transition",
                        filterType === "all"
                          ? "border border-blue-500/30 bg-blue-500/20 text-blue-400"
                          : "hover:bg-neutral-750 border border-neutral-700 bg-neutral-800 text-neutral-400",
                      )}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType("aws")}
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium transition",
                        filterType === "aws"
                          ? "border border-orange-500/30 bg-orange-500/20 text-orange-400"
                          : "hover:bg-neutral-750 border border-neutral-700 bg-neutral-800 text-neutral-400",
                      )}
                    >
                      AWS
                    </button>
                    <button
                      onClick={() => setFilterType("google")}
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium transition",
                        filterType === "google"
                          ? "border border-red-500/30 bg-red-500/20 text-red-400"
                          : "hover:bg-neutral-750 border border-neutral-700 bg-neutral-800 text-neutral-400",
                      )}
                    >
                      Google
                    </button>
                    <button
                      onClick={() => setFilterType("azure")}
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium transition",
                        filterType === "azure"
                          ? "border border-blue-500/30 bg-blue-500/20 text-blue-400"
                          : "hover:bg-neutral-750 border border-neutral-700 bg-neutral-800 text-neutral-400",
                      )}
                    >
                      Azure
                    </button>
                    <button
                      onClick={() => setFilterType("custom")}
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium transition",
                        filterType === "custom"
                          ? "border border-green-500/30 bg-green-500/20 text-green-400"
                          : "hover:bg-neutral-750 border border-neutral-700 bg-neutral-800 text-neutral-400",
                      )}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-neutral-400">
                    {sortDirection === "asc" ? (
                      <IconSortAscending className="h-3.5 w-3.5" />
                    ) : (
                      <IconSortDescending className="h-3.5 w-3.5" />
                    )}{" "}
                    Sort by:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-md border border-neutral-700 bg-neutral-800 py-1 pl-2.5 pr-8 text-xs text-neutral-300 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="name">Name</option>
                    <option value="resourceCount">Resource Count</option>
                    <option value="syncStatus">Status</option>
                    <option value="createdAt">Date Created</option>
                  </select>
                  <button
                    onClick={() =>
                      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                    }
                    className="hover:bg-neutral-750 rounded-md border border-neutral-700 bg-neutral-800 p-1 text-neutral-400"
                  >
                    {sortDirection === "asc" ? (
                      <IconSortAscending className="h-4 w-4" />
                    ) : (
                      <IconSortDescending className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-span-3">
              {providers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-12">
                  <IconSearch className="mb-4 h-12 w-12 text-neutral-600" />
                  <h3 className="mb-1 text-lg font-medium text-neutral-300">
                    No providers found
                  </h3>
                  <p className="max-w-md text-center text-sm text-neutral-500">
                    No providers match your current search and filter criteria.
                    Try adjusting your filters or search term.
                  </p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setFilterType("all");
                    }}
                    className="hover:bg-neutral-750 mt-4 rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition"
                  >
                    Clear filters
                  </button>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {providers.map((provider) => {
                    // Determine provider type
                    let type: "aws" | "google" | "azure" | "custom" = "custom";
                    let typeName = "Custom Provider";

                    if (provider.googleConfig) {
                      type = "google";
                      typeName = "Google Cloud Platform";
                    } else if (provider.awsConfig) {
                      type = "aws";
                      typeName = "Amazon Web Services";
                    } else if (provider.azureConfig) {
                      type = "azure";
                      typeName = "Microsoft Azure";
                    }

                    return (
                      <ProviderCard
                        key={provider.id}
                        id={provider.id}
                        name={provider.name}
                        type={type}
                        typeName={typeName}
                        resourceCount={provider.resourceCount}
                        resourceKinds={provider.kinds}
                        syncStatus={provider.syncStatus}
                        lastSyncTime={provider.lastSyncTime}
                        filterLink={provider.filterLink}
                      />
                    );
                  })}
                </div>
              ) : viewMode === "compact" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {providers.map((provider) => {
                    // Determine provider type
                    let type: "aws" | "google" | "azure" | "custom" = "custom";
                    let typeName = "Custom Provider";

                    if (provider.googleConfig) {
                      type = "google";
                      typeName = "Google Cloud Platform";
                    } else if (provider.awsConfig) {
                      type = "aws";
                      typeName = "Amazon Web Services";
                    } else if (provider.azureConfig) {
                      type = "azure";
                      typeName = "Microsoft Azure";
                    }

                    return (
                      <ProviderCard
                        key={provider.id}
                        id={provider.id}
                        name={provider.name}
                        type={type}
                        typeName={typeName}
                        resourceCount={provider.resourceCount}
                        resourceKinds={provider.kinds}
                        syncStatus={provider.syncStatus}
                        lastSyncTime={provider.lastSyncTime}
                        filterLink={provider.filterLink}
                        compact={true}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-neutral-800">
                  <table className="w-full table-fixed">
                    <thead className="bg-neutral-850">
                      <tr>
                        <th className="w-3/12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                          Provider
                        </th>
                        <th className="w-2/12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                          Type
                        </th>
                        <th className="w-2/12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                          Resources
                        </th>
                        <th className="w-2/12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                          Status
                        </th>
                        <th className="w-2/12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                          Last Sync
                        </th>
                        <th className="w-1/12 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {providers.map((provider) => {
                        // Determine provider type
                        let type: "aws" | "google" | "azure" | "custom" =
                          "custom";
                        let typeName = "Custom Provider";

                        if (provider.googleConfig) {
                          type = "google";
                          typeName = "Google Cloud Platform";
                        } else if (provider.awsConfig) {
                          type = "aws";
                          typeName = "Amazon Web Services";
                        } else if (provider.azureConfig) {
                          type = "azure";
                          typeName = "Microsoft Azure";
                        }

                        const statusDetails = getSyncStatusDetails(
                          provider.syncStatus,
                        );

                        return (
                          <tr
                            key={provider.id}
                            className="hover:bg-neutral-850/50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-neutral-200">
                              {provider.name}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800/50">
                                  {type === "aws" ? (
                                    <SiAmazon className="h-3 w-3 text-orange-400" />
                                  ) : type === "google" ? (
                                    <SiGooglecloud className="h-3 w-3 text-red-400" />
                                  ) : type === "azure" ? (
                                    <IconBrandAzure className="h-3 w-3 text-blue-400" />
                                  ) : (
                                    <IconSettings className="h-3 w-3 text-blue-300" />
                                  )}
                                </div>
                                <span className="text-xs text-neutral-400">
                                  {type}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-300">
                              {provider.resourceCount}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`h-2 w-2 rounded-full ${statusDetails.bgColor}`}
                                ></div>
                                <span
                                  className={`text-xs ${statusDetails.color}`}
                                >
                                  {statusDetails.statusText}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-400">
                              {provider.lastSyncTime}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={provider.filterLink}
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "xs",
                                  }),
                                  "border-blue-500/30 bg-blue-500/10 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300",
                                )}
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
