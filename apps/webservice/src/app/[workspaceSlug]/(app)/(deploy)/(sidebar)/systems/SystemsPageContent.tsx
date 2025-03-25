"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconChevronDown,
  IconFilter,
  IconMenu2,
  IconPlant,
  IconPlus,
  IconSearch,
  IconShip,
  IconSortAscending,
  IconSortDescending,
  IconTopologyComplex,
} from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Input } from "@ctrlplane/ui/input";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/CreateDeployment";
import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { api } from "~/trpc/react";
import { Sidebars } from "../../../../sidebars";
import { SystemDeploymentSkeleton } from "./_components/system-deployment-table/SystemDeploymentSkeleton";
import { SystemDeploymentTable } from "./_components/system-deployment-table/SystemDeploymentTable";
import { CreateSystemDialog } from "./CreateSystem";

type SortOrder = "name-asc" | "name-desc" | "envs-asc" | "envs-desc";

const useSystemFilter = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const sort = searchParams.get("sort") as SortOrder | null;

  const setParams = (params: { filter?: string; sort?: SortOrder | "" }) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);

    if (params.filter !== undefined) {
      if (params.filter === "") {
        urlParams.delete("filter");
      } else {
        urlParams.set("filter", params.filter);
      }
    }

    if (params.sort == null || params.sort === "") {
      urlParams.delete("sort");
    } else {
      urlParams.set("sort", params.sort);
    }

    router.replace(`${url.pathname}?${urlParams.toString()}`);
  };

  return {
    filter,
    sort,
    setFilter: (filter: string) => setParams({ selector: selector }),
    setSort: (sort: SortOrder) => setParams({ sort }),
    setParams,
  };
};

export const SystemsPageContent: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => {
  const { filter, sort, setFilter, setSort } = useSystemFilter();
  const [search, setSearch] = useState(filter ?? "");

  useEffect(() => {
    if (search !== (filter ?? "")) {
      const debounceTimeout = setTimeout(() => {
        setFilter(search);
      }, 300);
      return () => clearTimeout(debounceTimeout);
    }
  }, [search, filter, setFilter]);

  const workspaceId = workspace.id;
  const query = filter ?? undefined;
  const { data, isLoading } = api.system.list.useQuery(
    { workspaceId, query },
    { placeholderData: (prev) => prev },
  );

  const systems = data?.items ?? [];
  const totalSystems = data?.total ?? 0;

  // Calculate total deployments and environments
  const totalDeployments = systems.reduce(
    (total, system) => total + system.deployments.length,
    0,
  );
  const totalEnvironments = systems.reduce((total, system) => {
    // Assuming an environment count is available on the system object
    // This will need to be adjusted based on your actual data structure
    return total + (system.environments.length || 0);
  }, 0);

  // Sort systems based on the selected sort order
  const sortedSystems = [...systems].sort((a, b) => {
    switch (sort) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "envs-asc":
        return (a.environments.length || 0) - (b.environments.length || 0);
      case "envs-desc":
        return (b.environments.length || 0) - (a.environments.length || 0);
      default:
        // Default sort is by name ascending
        return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="flex flex-col">
      <PageHeader className="z-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SidebarTrigger name={Sidebars.Deployments}>
            <IconMenu2 className="h-4 w-4" />
          </SidebarTrigger>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage className="flex items-center gap-1.5">
                  <IconTopologyComplex className="h-4 w-4" />
                  Systems
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <CreateSystemDialog workspace={workspace}>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
            >
              <IconPlus className="h-3.5 w-3.5" />
              New System
            </Button>
          </CreateSystemDialog>
          <CreateDeploymentDialog>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
            >
              <IconPlus className="h-3.5 w-3.5" />
              New Deployment
            </Button>
          </CreateDeploymentDialog>
        </div>
      </PageHeader>

      <div className="space-y-8 p-8">
        {/* Only show stats and filters if there are systems */}
        {!isLoading && systems.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <div className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <IconTopologyComplex className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold">{totalSystems}</span>
                    <span className="text-sm text-muted-foreground">
                      Systems
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <IconShip className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold">
                      {totalDeployments}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Deployments
                    </span>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <IconPlant className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold">
                      {totalEnvironments}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Environments
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:w-1/2 lg:w-1/3">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search systems and deployments..."
                  className="pl-9"
                />
              </div>

              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5"
                    >
                      <IconFilter className="h-3.5 w-3.5" />
                      Sort
                      <IconChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => setSort("name-asc")}
                        className="flex items-center justify-between"
                      >
                        Name (A-Z)
                        {sort === "name-asc" && (
                          <IconSortAscending className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSort("name-desc")}
                        className="flex items-center justify-between"
                      >
                        Name (Z-A)
                        {sort === "name-desc" && (
                          <IconSortDescending className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSort("envs-desc")}
                        className="flex items-center justify-between"
                      >
                        Environments (Most)
                        {sort === "envs-desc" && (
                          <IconSortDescending className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSort("envs-asc")}
                        className="flex items-center justify-between"
                      >
                        Environments (Least)
                        {sort === "envs-asc" && (
                          <IconSortAscending className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!isLoading &&
          systems.length === 0 &&
          (search ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5">
                <IconTopologyComplex className="h-10 w-10 text-primary/60" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">No systems found</h3>
              <p className="mb-8 max-w-md text-muted-foreground">
                No systems match your search "{search}". Try a different search
                term.
              </p>
            </Card>
          ) : (
            <div className="h-full w-full p-20">
              <div className="container m-auto max-w-xl space-y-6 p-20">
                <div className="relative -ml-1 text-neutral-500">
                  <IconTopologyComplex
                    className="h-10 w-10"
                    strokeWidth={0.5}
                  />
                </div>
                <div className="font-semibold">Systems</div>
                <div className="prose prose-invert text-sm text-muted-foreground">
                  <p>
                    Systems serve as a high-level category or grouping for your
                    deployments. A system encompasses a set of related
                    deployments that share common characteristics, such as the
                    same environments and environment policies.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CreateSystemDialog workspace={workspace}>
                    <Button size="sm">Create System</Button>
                  </CreateSystemDialog>
                  <Link
                    href="https://docs.ctrlplane.dev/core-concepts/systems"
                    target="_blank"
                    passHref
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Documentation
                  </Link>
                </div>
              </div>
            </div>
          ))}

        {/* System List */}
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <SystemDeploymentSkeleton key={i} />
          ))}

        {!isLoading && sortedSystems.length > 0 && (
          <div className="space-y-8">
            {sortedSystems.map((s) => (
              <SystemDeploymentTable
                key={s.id}
                workspace={workspace}
                system={s}
              />
            ))}
          </div>
        )}

        {/* Results Summary */}
        {!isLoading && systems.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {systems.length}{" "}
            {systems.length === 1 ? "system" : "systems"}
            {search && <span> for search "{search}"</span>}
          </div>
        )}
      </div>
    </div>
  );
};
