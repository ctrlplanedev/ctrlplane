import { useMemo, useState } from "react";
import { AlertCircle, Filter, Search } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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
import { SystemCard } from "./systems/_components/SystemCard";
import { mockSystems } from "./systems/_mockData";

export function meta() {
  return [
    { title: "Systems - Ctrlplane" },
    {
      name: "description",
      content: "Manage your systems",
    },
  ];
}

export default function Systems() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  // Get unique owners for filter
  const owners = Array.from(new Set(mockSystems.map((sys) => sys.owner)));

  // Filter systems based on search and filters
  const filteredSystems = useMemo(() => {
    return mockSystems.filter((system) => {
      const matchesSearch =
        searchQuery === "" ||
        system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        system.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        system.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        system.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      const matchesStatus =
        statusFilter === "all" || system.status === statusFilter;

      const matchesOwner =
        ownerFilter === "all" || system.owner === ownerFilter;

      return matchesSearch && matchesStatus && matchesOwner;
    });
  }, [searchQuery, statusFilter, ownerFilter]);

  // Calculate stats
  const stats = {
    total: filteredSystems.length,
    healthy: filteredSystems.filter((s) => s.status === "healthy").length,
    warning: filteredSystems.filter((s) => s.status === "warning").length,
    degraded: filteredSystems.filter((s) => s.status === "degraded").length,
    totalDeployments: filteredSystems.reduce(
      (sum, s) => sum + s.deploymentCount,
      0,
    ),
    totalResources: filteredSystems.reduce(
      (sum, s) => sum + s.resourceCount,
      0,
    ),
  };

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
                <BreadcrumbPage>Systems</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <Button disabled>Create System</Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Systems
                  </p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="flex gap-1">
                  <div className="flex flex-col items-end text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      {stats.healthy}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      {stats.warning}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      {stats.degraded}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Deployments
                </p>
                <p className="text-2xl font-bold">{stats.totalDeployments}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Resources
                </p>
                <p className="text-2xl font-bold">{stats.totalResources}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Health Rate
                </p>
                <p className="text-2xl font-bold">
                  {stats.total > 0
                    ? Math.round((stats.healthy / stats.total) * 100)
                    : 0}
                  %
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search systems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
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
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* System Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSystems.map((system) => (
            <SystemCard key={system.id} system={system} />
          ))}
        </div>

        {/* Empty State */}
        {filteredSystems.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No systems found</h3>
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
