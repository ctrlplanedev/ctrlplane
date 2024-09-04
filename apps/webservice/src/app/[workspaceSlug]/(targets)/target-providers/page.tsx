"use client";

import { formatDistanceToNow } from "date-fns";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { ProviderActionsDropdown } from "./ProviderActionsDropdown";
import { TargetProvidersGettingStarted } from "./TargetProvidersGettingStarted";

export default function TargetProvidersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const targetProviders = api.target.provider.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );

  if (targetProviders.isSuccess && targetProviders.data.length === 0)
    return <TargetProvidersGettingStarted />;

  return (
    <div>
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {targetProviders.data?.map((provider) => (
            <TableRow
              key={provider.id}
              className="cursor-pointer border-b-neutral-800/50"
            >
              <TableCell className="flex items-center gap-2">
                {provider.name}
                <Badge
                  variant="outline"
                  className="h-7 gap-1.5 rounded-full bg-neutral-900 bg-transparent px-2 text-xs text-muted-foreground"
                >
                  {provider.targetCount}{" "}
                  {provider.targetCount === 1 ? "target" : "targets"}
                </Badge>
              </TableCell>
              <TableCell>
                {provider.kinds.map((kind) => (
                  <Badge
                    key={kind.kind}
                    variant="outline"
                    className="mr-1 h-7 gap-1.5 rounded-full bg-neutral-900 bg-transparent px-2 text-xs text-muted-foreground"
                  >
                    {kind.kind}
                  </Badge>
                ))}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span>
                        {new Date(provider.createdAt).toLocaleDateString()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatDistanceToNow(new Date(provider.createdAt), {
                        addSuffix: true,
                      })}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell className="text-right">
                <ProviderActionsDropdown providerId={provider.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
