"use client";

import { notFound } from "next/navigation";
import { format } from "date-fns";
import { TbLoader2, TbLock, TbLockOpen } from "react-icons/tb";

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

const DeploymentsTable: React.FC<{ targetId: string }> = ({ targetId }) => {
  const jobs = api.job.byTargetId.useQuery(targetId);
  const deployments = api.deployment.byTargetId.useQuery(targetId);
  return (
    <Table className="w-full min-w-max border-separate border-spacing-0">
      <TableBody>
        {deployments.data?.map((deployment, idx) => {
          const releaseJobTrigger = jobs.data
            ?.filter(
              (j) => j.job.status === "completed" || j.job.status === "pending",
            )
            .find((j) => j.deployment?.id === deployment.id);

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
                    releaseJobTrigger={{
                      ...releaseJobTrigger,
                      release: releaseJobTrigger.release,
                      job: releaseJobTrigger.job,
                    }}
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

const TargetLabelsInfo: React.FC<{ labels: Record<string, string> }> = (
  props,
) => {
  const labels = Object.entries(props.labels).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );
  const { search, setSearch, result } = useMatchSorterWithSearch(labels, {
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
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 overflow-auto rounded-b-lg border-x border-b p-1.5">
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

export default function TargetPage({
  params,
}: {
  params: { targetId: string };
}) {
  const target = api.target.byId.useQuery(params.targetId);
  const jobs = api.job.byTargetId.useQuery(params.targetId);
  const deployments = api.deployment.byTargetId.useQuery(params.targetId);

  const unlockTarget = api.target.unlock.useMutation();
  const lockTarget = api.target.lock.useMutation();

  const utils = api.useUtils();

  const isLoading = target.isLoading || jobs.isLoading || deployments.isLoading;

  if (!target.isLoading && target.data == null) notFound();
  if (isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <TbLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={70}>
        <div className="flex items-center border-b p-4 px-8 text-xl">
          <span className="flex-grow">{target.data?.name}</span>
          {target.data != null && (
            <Button
              variant="outline"
              className="gap-1"
              onClick={() => {
                const mutation =
                  target.data!.lockedAt != null ? unlockTarget : lockTarget;
                mutation
                  .mutateAsync(target.data!.id)
                  .then(() => utils.target.byId.invalidate(params.targetId));
              }}
            >
              {target.data.lockedAt != null ? (
                <>
                  <TbLockOpen /> Unlocked
                </>
              ) : (
                <>
                  <TbLock /> Lock
                </>
              )}
            </Button>
          )}
        </div>

        <div className="max-4-xl container mx-auto space-y-8 p-8">
          <div className="space-y-5">
            <div className="text-sm text-muted-foreground">Deployments</div>
            <DeploymentsTable targetId={params.targetId} />
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
                <td>{target.data?.name}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Version</td>
                <td>{target.data?.version}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">Kind</td>
                <td>{target.data?.kind}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-muted-foreground">
                  Target Provider
                </td>
                {target.isSuccess && (
                  <>
                    {target.data?.provider != null ? (
                      target.data.provider.name
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
                              The next target provider to insert a target with
                              the same identifier will become the owner of this
                              target.
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
                  {target.data?.updatedAt &&
                    format(target.data.updatedAt, "MM/dd/yyyy mm:hh:ss")}
                </td>
              </tr>
              <tr>
                <td className="p-1 py-1 pr-2 text-muted-foreground">Link</td>
                {/* <td>
                {link == null ? (
                  <span className="text-muted-foreground">Not set</span>
                ) : (
                  <a
                    href={link}
                    className="inline-block w-full overflow-hidden text-ellipsis text-nowrap hover:text-blue-400"
                  >
                    {link}
                  </a>
                )}
              </td> */}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-b" />
        <div className="p-6">
          <div className="mb-4">Labels</div>
          <TargetLabelsInfo labels={target.data?.labels ?? {}} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
