"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { IconLoader2, IconLock, IconLockOpen } from "@tabler/icons-react";
import { format } from "date-fns";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Input } from "@ctrlplane/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { ReleaseCell } from "./ReleaseCell";

const DeploymentsTable: React.FC<{ resourceId: string }> = ({ resourceId }) => {
  const jobs = api.job.byResourceId.useQuery(resourceId);
  const deployments = api.deployment.byResourceId.useQuery(resourceId);
  return (
    <Table className="w-full min-w-max border-separate border-spacing-0">
      <TableBody>
        {deployments.data?.map((deployment, idx) => {
          const releaseJobTrigger = jobs.data?.find(
            (j) => j.deployment.id === deployment.id,
          );

          return (
            <TableRow key={deployment.id}>
              <TableCell
                className={cn(
                  "items-center border-b border-l border-t px-4 text-lg",
                  idx === 0 && "rounded-tl-md border-t",
                  idx === deployments.data.length - 1 && "rounded-bl-md",
                )}
              >
                {deployment.name}
              </TableCell>
              <TableCell
                className={cn(
                  "h-[55px] w-[200px] border-x border-b border-neutral-800 border-x-neutral-800/30 border-r-neutral-800 p-2 px-3",
                  idx === 0 && "rounded-tr-md border-t",
                  idx === deployments.data.length - 1 && "rounded-br-md",
                )}
              >
                {releaseJobTrigger && (
                  <ReleaseCell
                    deployment={deployment}
                    releaseJobTrigger={releaseJobTrigger}
                  />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const ResourceMetadataInfo: React.FC<{ metadata: Record<string, string> }> = (
  props,
) => {
  const metadata = Object.entries(props.metadata).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );
  const { search, setSearch, result } = useMatchSorterWithSearch(metadata, {
    keys: ["0", "1"],
  });
  return (
    <div>
      <div className="text-xs">
        <div>
          <Input
            className="w-full rounded-b-none text-xs"
            placeholder="Search ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 overflow-auto rounded-b-lg border-x border-b p-1.5">
          {result.map(([key, value]) => (
            <div className="text-nowrap font-mono">
              <span className="text-red-400">{key}:</span>{" "}
              <span className="text-green-300">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function ResourcePage(props: {
  params: Promise<{ resourceId: string }>;
}) {
  const params = use(props.params);
  const resourceId = params.resourceId;
  const resource = api.resource.byId.useQuery(resourceId);
  const jobs = api.job.byResourceId.useQuery(resourceId);
  const deployments = api.deployment.byResourceId.useQuery(resourceId);

  const unlockResource = api.resource.unlock.useMutation();
  const lockResource = api.resource.lock.useMutation();

  const utils = api.useUtils();

  const isLoading =
    resource.isLoading || jobs.isLoading || deployments.isLoading;

  if (!resource.isLoading && resource.data == null) notFound();
  if (isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={70}>
        <div className="flex items-center border-b p-4 px-8 text-xl">
          <span className="flex-grow">{resource.data?.name}</span>
          {resource.data != null && (
            <Button
              variant="outline"
              className="gap-1"
              onClick={() => {
                const mutation =
                  resource.data!.lockedAt != null
                    ? unlockResource
                    : lockResource;
                mutation
                  .mutateAsync(resource.data!.id)
                  .then(() =>
                    utils.resource.byId.invalidate(params.resourceId),
                  );
              }}
            >
              {resource.data.lockedAt != null ? (
                <>
                  <IconLockOpen className="h-4 w-4" /> Unlocked
                </>
              ) : (
                <>
                  <IconLock className="h-4 w-4" /> Lock
                </>
              )}
            </Button>
          )}
        </div>

        <div className="max-4-xl container mx-auto space-y-8 p-8">
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">Deployments</div>
            <DeploymentsTable resourceId={params.resourceId} />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={30} className="min-w-[350px] text-sm">
        <div className="p-6">
          <div className="mb-2">Properties</div>
          <table width="100%" style={{ tableLayout: "fixed" }}>
            <tbody>
              <tr>
                <td className="w-[130px] py-1 pr-2 text-muted-foreground">
                  ID
                </td>
                <td>{resource.data?.name}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Version</td>
                <td>{resource.data?.version}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Kind</td>
                <td>{resource.data?.kind}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">
                  Resource Provider
                </td>
                {resource.isSuccess && (
                  <>
                    {resource.data?.provider != null ? (
                      resource.data.provider.name
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="cursor-help italic text-gray-500">
                              Not set
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[250px]">
                              The next resource provider to insert a resource
                              with the same identifier will become the owner of
                              this resource.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </>
                )}
              </tr>

              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Last Sync</td>
                <td>
                  {resource.data?.updatedAt &&
                    format(resource.data.updatedAt, "MM/dd/yyyy mm:hh:ss")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-b" />
        <div className="p-6">
          <div className="mb-4">Metadata</div>
          <ResourceMetadataInfo metadata={resource.data?.metadata ?? {}} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
