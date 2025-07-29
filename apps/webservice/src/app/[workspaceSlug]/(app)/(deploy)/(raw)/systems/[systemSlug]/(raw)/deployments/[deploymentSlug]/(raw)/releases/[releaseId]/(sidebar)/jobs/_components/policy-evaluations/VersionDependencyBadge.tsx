import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconSitemapFilled } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
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

import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { urls } from "~/app/urls";

type Dependency = schema.VersionDependency & {
  resourcesForDependency: schema.Resource[];
  deployment: schema.Deployment;
};

const SingleResourceCell: React.FC<{
  resource: schema.Resource;
}> = ({ resource }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const resourceUrl = urls
    .workspace(workspaceSlug)
    .resource(resource.id)
    .deployments();

  return (
    <TableCell>
      <Link
        href={resourceUrl}
        className="flex max-w-60 items-center gap-1 truncate"
      >
        <ResourceIcon
          version={resource.version}
          kind={resource.kind}
          className="h-3 w-3 flex-shrink-0"
        />
        {resource.name}
      </Link>
    </TableCell>
  );
};

const ResourceCell: React.FC<{
  resources: schema.Resource[];
}> = ({ resources }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  if (resources.length === 0)
    return (
      <TableCell>
        <div className="text-xs text-muted-foreground">No resources</div>
      </TableCell>
    );

  if (resources.length === 1)
    return <SingleResourceCell resource={resources[0]!} />;

  return (
    <TableCell>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-pointer">
              {resources.length} resources
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="flex max-w-96 flex-col gap-1.5 border bg-neutral-950 p-2">
            {resources.map((resource) => (
              <Link
                key={resource.id}
                href={urls
                  .workspace(workspaceSlug)
                  .resource(resource.id)
                  .deployments()}
                className="flex items-center gap-1 truncate"
              >
                <ResourceIcon
                  version={resource.version}
                  kind={resource.kind}
                  className="h-3 w-3 flex-shrink-0"
                />
                {resource.name}
              </Link>
            ))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </TableCell>
  );
};

const DependencyRow: React.FC<{
  dependency: Dependency;
}> = ({ dependency }) => (
  <TableRow>
    <TableCell>{dependency.deployment.name}</TableCell>
    <TableCell>
      {dependency.versionSelector != null && (
        <DeploymentVersionConditionBadge
          condition={dependency.versionSelector}
        />
      )}
      {dependency.versionSelector == null && (
        <div className="text-xs text-muted-foreground">No version selector</div>
      )}
    </TableCell>
    <ResourceCell resources={dependency.resourcesForDependency} />
  </TableRow>
);

export const VersionDependencyBadge: React.FC<{
  resource: { id: string; name: string };
  version: { tag: string };
  dependencyResults: Dependency[];
}> = ({ resource, version, dependencyResults }) => (
  <Dialog>
    <DialogTrigger asChild>
      <div className="flex items-center gap-2 rounded-md border border-neutral-500 px-2 py-1 text-xs text-neutral-500">
        <IconSitemapFilled className="h-4 w-4" />
        Missing dependencies
      </div>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{resource.name} is missing dependencies</DialogTitle>
        <DialogDescription>
          {resource.name} is missing the following dependencies specified for
          version {version.tag}
        </DialogDescription>
      </DialogHeader>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deployment</TableHead>
            <TableHead>Version Selector</TableHead>
            <TableHead>Resources checked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dependencyResults.map((dependency) => (
            <DependencyRow key={dependency.id} dependency={dependency} />
          ))}
        </TableBody>
      </Table>
    </DialogContent>
  </Dialog>
);
