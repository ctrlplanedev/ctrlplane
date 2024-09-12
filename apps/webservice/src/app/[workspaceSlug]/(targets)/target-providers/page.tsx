import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { TbSettings } from "react-icons/tb";

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

import { api } from "~/trpc/server";
import { ProviderActionsDropdown } from "./ProviderActionsDropdown";
import { TargetProvidersGettingStarted } from "./TargetProvidersGettingStarted";

export default async function TargetProvidersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const targetProviders = await api.target.provider.byWorkspaceId(workspace.id);

  if (targetProviders.length === 0) return <TargetProvidersGettingStarted />;

  return (
    <div>
      <Table className="w-full border border-x-0 border-t-0 border-b-neutral-800/50">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {targetProviders.map((provider) => (
            <TableRow
              key={provider.id}
              className="cursor-pointer border-b-neutral-800/50"
            >
              <TableCell>
                <div className="flex h-full items-center gap-1">
                  <span className="text-base">{provider.name}</span>
                  {provider.googleConfig == null && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge
                            variant="outline"
                            className="h-6 gap-1.5 rounded-full border-none bg-blue-500/10 pl-2 pr-3 text-xs text-blue-300"
                          >
                            <TbSettings className="" /> Custom
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px]">
                          A custom provider is when you are running your own
                          agent instead of using managed agents built inside
                          Ctrlplane. Your agent directly calls Ctrlplane's API
                          to create targets.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Badge
                    variant="outline"
                    className="h-6 gap-1.5 rounded-full border-none bg-neutral-800/50 px-2 text-xs text-muted-foreground"
                  >
                    {provider.targetCount}{" "}
                    {provider.targetCount === 1 ? "target" : "targets"}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                {provider.kinds.length > 0 ? (
                  provider.kinds.map((kind) => (
                    <Badge
                      key={kind.kind}
                      variant="outline"
                      className="mr-1 h-7 gap-1.5 rounded-full bg-neutral-900 bg-transparent px-2 text-xs text-muted-foreground"
                    >
                      {kind.kind}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    No targets
                  </span>
                )}
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
                <ProviderActionsDropdown provider={provider} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
