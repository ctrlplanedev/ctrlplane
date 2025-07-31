import Link from "next/link";
import { useParams } from "next/navigation";
import { IconClock, IconExternalLink } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { PolicyEvaluation } from "./utils";
import { urls } from "~/app/urls";

export const BlockingReleaseTargetJobTooltip: React.FC<{
  jobInfo: NonNullable<
    PolicyEvaluation["rules"]["releaseTargetConcurrencyBlocked"]["jobInfo"]
  >;
}> = ({ jobInfo }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(jobInfo.system.slug)
    .deployment(jobInfo.deployment.slug)
    .release(jobInfo.version.id)
    .jobs();

  const linksMetadata = jobInfo.job.metadata[ReservedMetadataKey.Links] ?? "{}";
  const links = JSON.parse(linksMetadata) as Record<string, string>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 rounded-md border border-neutral-500 px-2 py-1 text-xs text-neutral-500">
            <IconClock className="h-4 w-4" />
            Another job is running
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex w-96 flex-col gap-2 border bg-neutral-950 p-2">
          <div className="flex w-full items-center justify-between truncate">
            <span className="flex-shrink-0">Version:</span>
            <Link
              href={versionUrl}
              className="hover:underline"
              target="_blank"
              rel="noreferrer noopener"
            >
              {jobInfo.version.name}
            </Link>
          </div>
          <div className="flex w-full items-center justify-between truncate">
            <span className="flex-shrink-0">Job:</span>
            <div className="flex items-center gap-1">
              {Object.entries(links).map(([key, value]) => (
                <Link
                  key={key}
                  href={value}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "flex h-6 items-center gap-1",
                  )}
                >
                  <IconExternalLink className="h-3 w-3" />
                  {key}
                </Link>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
