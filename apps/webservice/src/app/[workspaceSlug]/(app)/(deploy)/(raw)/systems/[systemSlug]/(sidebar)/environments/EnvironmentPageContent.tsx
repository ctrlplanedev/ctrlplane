"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useDebounce } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { usePagination } from "~/app/[workspaceSlug]/(app)/_hooks/usePagination";
import { api } from "~/trpc/react";
import { SystemBreadcrumb } from "../_components/SystemBreadcrumb";
import { CreateEnvironmentDialog } from "./_components/CreateEnvironmentDialog";
import { EnvironmentCard } from "./_components/EnvironmentCard";

const PAGE_SIZE = 9;

export const EnvironmentPageContent: React.FC<{
  system: SCHEMA.System;
}> = ({ system }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const allEnvironmentsQ = api.environment.bySystemIdWithSearch.useQuery({
    systemId: system.id,
    limit: 0,
    query: debouncedSearch,
  });

  const totalEnvironments = allEnvironmentsQ.data?.count ?? 0;
  const { page, setPage, hasPreviousPage, hasNextPage } = usePagination(
    totalEnvironments,
    PAGE_SIZE,
  );

  const environmentsQ = api.environment.bySystemIdWithSearch.useQuery({
    systemId: system.id,
    query: debouncedSearch,
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  const environments = environmentsQ.data?.items ?? [];

  return (
    <div>
      <PageHeader className="justify-between">
        <SystemBreadcrumb system={system} page="Environments" />
        <CreateEnvironmentDialog systemId={system.id}>
          <Button variant="outline" size="sm">
            Create Environment
          </Button>
        </CreateEnvironmentDialog>
      </PageHeader>

      <div className="flex justify-between px-6 pt-6">
        <h2 className="text-lg font-medium">
          Environments{" "}
          {allEnvironmentsQ.isLoading ? "..." : `(${totalEnvironments})`}
        </h2>
        <Input
          placeholder="Search environments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
        {environments.map((environment) => (
          <EnvironmentCard
            key={environment.id}
            workspaceId={system.workspaceId}
            environment={environment}
          />
        ))}

        {environmentsQ.isLoading &&
          Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}

        {!environmentsQ.isLoading && environments.length === 0 && (
          <div className="col-span-full flex h-32 items-center justify-center rounded-lg border border-dashed border-neutral-800">
            <p className="text-sm text-neutral-400">
              No environments found.{" "}
              {search === ""
                ? "Create your first environment."
                : "Try a different search."}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 px-6">
        <Button
          variant="outline"
          disabled={!hasPreviousPage}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!hasNextPage}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
