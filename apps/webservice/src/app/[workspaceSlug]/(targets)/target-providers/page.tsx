import type { TargetCondition } from "@ctrlplane/validators/targets";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconExternalLink, IconSettings } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import LZString from "lz-string";

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
import { TargetFilterType } from "@ctrlplane/validators/targets";

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

  const providers = targetProviders.map((provider) => {
    const filter: TargetCondition = {
      type: TargetFilterType.Provider,
      value: provider.id,
      operator: "equals",
    };
    const hash = LZString.compressToEncodedURIComponent(JSON.stringify(filter));
    const filterLink = `/${workspaceSlug}/targets?filter=${hash}`;
    return { ...provider, filterLink };
  });

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 h-[calc(100vh-40px)] overflow-auto">
      <Table className="w-full border border-x-0 border-t-0 border-b-neutral-800/50">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider) => (
            <TableRow
              key={provider.id}
              className="cursor-pointer border-b-neutral-800/50"
            >
              <TableCell>
                <Link href={provider.filterLink} target="_blank">
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
                              <IconSettings className="h-4 w-4" /> Custom
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
                      className="flex h-6 items-center gap-1.5 rounded-full border-none bg-neutral-800/50 px-2 text-xs text-muted-foreground"
                    >
                      <IconExternalLink className="h-4 w-4" />
                      {provider.targetCount}{" "}
                      {provider.targetCount === 1 ? "target" : "targets"}
                    </Badge>
                  </div>
                </Link>
              </TableCell>
              <TableCell>
                {provider.kinds.length > 0 ? (
                  provider.kinds.map((kind) => (
                    <Badge
                      key={kind.kind}
                      variant="outline"
                      className="h-6 gap-1.5 rounded-full border-none bg-neutral-800/50 px-2 text-xs text-muted-foreground"
                    >
                      {kind.version}:{kind.kind}
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
                      <span className="text-xs text-muted-foreground">
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
