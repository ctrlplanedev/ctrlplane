/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Loader2, SearchIcon, ShieldOffIcon } from "lucide-react";
import { useDebounce } from "react-use";

import type { DeploymentVersionStatus } from "../types";
import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { DeploymentVersion } from "./DeploymentVersion";
import { PolicySkipDialog } from "./policy-skip/PolicySkipDialog";
import { usePolicyRulesForVersion } from "./usePolicyRulesForVersion";

const PAGE_SIZE = 20;

type Version = {
  id: string;
  name?: string;
  tag?: string;
  status: DeploymentVersionStatus;
};

type VersionRowProps = {
  version: Version;
  environment: { id: string; name: string };
};

function VersionRow({ version, environment }: VersionRowProps) {
  const { policyRules } = usePolicyRulesForVersion(version.id, environment.id);

  return (
    <div className="space-y-2 rounded-lg border p-2" key={version.id}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{version.name || version.tag}</h3>
        {policyRules.length > 0 && (
          <PolicySkipDialog
            environmentId={environment.id}
            versionId={version.id}
            rules={policyRules}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1.5 rounded-full px-2.5 text-xs"
            >
              <ShieldOffIcon className="size-3" />
              Skip Policy
            </Button>
          </PolicySkipDialog>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <DeploymentVersion version={version} environment={environment} />
      </div>
    </div>
  );
}

type EnvironmentVersionDecisionsProps = {
  environment: { id: string; name: string };
  deploymentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EnvironmentVersionDecisions({
  environment,
  deploymentId,
  open,
  onOpenChange,
}: EnvironmentVersionDecisionsProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageCount, setPageCount] = useState(1);

  useDebounce(
    () => {
      setDebouncedSearch(search);
      setPageCount(1);
    },
    250,
    [search],
  );

  const versionsQuery = trpc.deployment.searchVersions.useQuery(
    {
      deploymentId,
      query: debouncedSearch || undefined,
      limit: PAGE_SIZE * pageCount,
      offset: 0,
    },
    { refetchInterval: 5000, placeholderData: keepPreviousData },
  );

  const versions = versionsQuery.data ?? [];
  const hasMore = versions.length === PAGE_SIZE * pageCount;
  const isInitialLoading = versionsQuery.isLoading;
  const isEmpty = !isInitialLoading && versions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">{environment.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-180px)] overflow-y-auto px-4 pb-4">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by version name or tag..."
              className="pl-8"
            />
          </div>
          {isInitialLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading versions...
            </div>
          )}

          {isEmpty && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {debouncedSearch
                ? `No versions match "${debouncedSearch}"`
                : "No versions found"}
            </div>
          )}

          {!isInitialLoading && versions.length > 0 && (
            <div className="space-y-4 pt-4">
              {versions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  environment={environment}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageCount((c) => c + 1)}
                    disabled={versionsQuery.isFetching}
                  >
                    {versionsQuery.isFetching ? (
                      <>
                        <Loader2 className="mr-2 size-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
