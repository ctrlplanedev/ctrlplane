import type { RouterOutputs } from "@ctrlplane/api";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiAmazon, SiGooglecloud } from "@icons-pack/react-simple-icons";
import {
  IconBrandAzure,
  IconExternalLink,
  IconSettings,
} from "@tabler/icons-react";
import LZString from "lz-string";

import { cn } from "@ctrlplane/ui";
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
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { api } from "~/trpc/server";
import { ProviderActionsDropdown } from "./ProviderActionsDropdown";
import { ResourceProvidersGettingStarted } from "./ResourceProvidersGettingStarted";

export const metadata: Metadata = { title: "Resource Providers | Ctrlplane" };
type ResourceProvider =
  RouterOutputs["resource"]["provider"]["byWorkspaceId"][number];

const isCustomProvider = (provider: ResourceProvider) =>
  provider.googleConfig == null &&
  provider.awsConfig == null &&
  provider.azureConfig == null;

const CustomProviderTooltipBadge: React.FC = () => (
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
        A custom provider is when you are running your own agent instead of
        using managed agents built inside Ctrlplane. Your agent directly calls
        Ctrlplane's API to create resources.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const ManagedProviderBadge: React.FC<{
  provider: ResourceProvider;
}> = ({ provider }) => (
  <Badge
    variant="secondary"
    className={cn(
      "flex h-6 w-fit items-center gap-1 rounded-full px-2 py-0 text-xs",
      provider.googleConfig != null && "bg-red-400/20 text-red-400",
      provider.awsConfig != null && "bg-orange-400/20 text-orange-400",
      provider.azureConfig != null && "bg-blue-400/20 text-blue-400",
    )}
  >
    {provider.googleConfig != null && (
      <>
        <SiGooglecloud className="h-3 w-3" />
        Google
      </>
    )}
    {provider.awsConfig != null && (
      <>
        <SiAmazon className="h-3 w-3" />
        AWS
      </>
    )}
    {provider.azureConfig != null && (
      <>
        <IconBrandAzure className="h-3 w-3" />
        Azure
      </>
    )}
  </Badge>
);

export default async function ResourceProvidersPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const resourceProviders = await api.resource.provider.byWorkspaceId(
    workspace.id,
  );

  if (resourceProviders.length === 0)
    return <ResourceProvidersGettingStarted />;

  const providers = resourceProviders.map((provider) => {
    const filter: ResourceCondition = {
      type: ResourceFilterType.Provider,
      value: provider.id,
      operator: "equals",
    };
    const hash = LZString.compressToEncodedURIComponent(JSON.stringify(filter));
    const filterLink = `/${workspaceSlug}/resources?filter=${hash}`;
    return { ...provider, filterLink };
  });

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-[calc(100vh-50px)] overflow-auto">
      <Table className="w-full border border-x-0 border-t-0 border-b-neutral-800/50">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Resources</TableHead>
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
                <div className="flex h-full items-center gap-2">
                  <span className="text-base">{provider.name}</span>
                  {isCustomProvider(provider) ? (
                    <CustomProviderTooltipBadge />
                  ) : (
                    <ManagedProviderBadge provider={provider} />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Link href={provider.filterLink} target="_blank">
                  <Badge
                    variant="outline"
                    className="flex h-6 w-fit items-center gap-1.5 rounded-full border-none bg-neutral-800/50 px-2 text-xs text-muted-foreground"
                  >
                    <IconExternalLink className="h-4 w-4" />
                    {provider.resourceCount}{" "}
                    {provider.resourceCount === 1 ? "resource" : "resources"}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell>
                {provider.kinds.length === 0 && (
                  <span className="text-xs italic text-muted-foreground">
                    No resources
                  </span>
                )}
                {provider.kinds.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {provider.kinds.map((kind) => (
                      <Badge
                        key={kind.kind}
                        variant="outline"
                        className="h-6 gap-1.5 rounded-full border-none bg-neutral-800/50 px-2 text-xs text-muted-foreground"
                      >
                        {kind.version}:{kind.kind}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(provider.createdAt).toLocaleDateString()}
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
