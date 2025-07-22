import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";
import { format } from "date-fns";

import { buttonVariants } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { Deployment, Version } from "./types";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { urls } from "~/app/urls";

const VersionRow: React.FC<{
  version: Version;
  versionUrl: string;
}> = ({ version, versionUrl }) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex-shrink-0">Current version:</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex max-w-60 items-center gap-2 truncate">
              <JobTableStatusIcon status={version.job.status} />
              <Link
                href={versionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {version.name}
              </Link>
            </div>
          </TooltipTrigger>
          <TooltipContent className="flex flex-col gap-1">
            <span className="flex items-center justify-between gap-2 text-muted-foreground">
              Tag: <span className="font-mono">{version.tag}</span>
            </span>
            <span className="flex items-center justify-between gap-2 text-muted-foreground">
              Name: <span className="font-mono">{version.name}</span>
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

const DeployedAtRow: React.FC<{
  deployedAt: Date;
}> = ({ deployedAt }) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex-shrink-0">Deployed at:</span>
      <span>{format(deployedAt, "MMM d, hh:mm aa")}</span>
    </div>
  );
};

const LinksRow: React.FC<{
  metadata: Record<string, string>;
}> = ({ metadata }) => {
  const linksMetadata = metadata[ReservedMetadataKey.Links] ?? "{}";
  const links = JSON.parse(linksMetadata) as Record<string, string>;
  const linksArray = Object.entries(links);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex-shrink-0">Links:</span>
      {linksArray.length === 0 && (
        <span className="text-sm text-muted-foreground">No links</span>
      )}
      <div className="flex items-center gap-2">
        {linksArray.map(([label, url]) => (
          <Link
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "flex items-center gap-2",
            })}
          >
            <IconExternalLink className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export const DeploymentExpanded: React.FC<{
  systemSlug: string;
  deployment: Deployment;
  children: React.ReactNode;
}> = ({ deployment, systemSlug, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const getVersionUrl = (versionId: string) =>
    urls
      .workspace(workspaceSlug)
      .system(systemSlug)
      .deployment(deployment.slug)
      .release(versionId)
      .baseUrl();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex flex-col gap-8">
        <DialogHeader>
          <DialogTitle>{deployment.name}</DialogTitle>
        </DialogHeader>
        {deployment.releaseTarget?.version != null && (
          <div className="flex flex-col gap-1.5 text-sm">
            <VersionRow
              version={deployment.releaseTarget.version}
              versionUrl={getVersionUrl(deployment.releaseTarget.version.id)}
            />
            <DeployedAtRow
              deployedAt={deployment.releaseTarget.version.job.createdAt}
            />
            <LinksRow
              metadata={deployment.releaseTarget.version.job.metadata}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
