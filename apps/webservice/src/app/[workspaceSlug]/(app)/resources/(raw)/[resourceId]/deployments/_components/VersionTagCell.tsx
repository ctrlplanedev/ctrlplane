import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { urls } from "~/app/urls";

export const VersionTagCell: React.FC<{
  version: { id: string; tag: string };
  urlParams: {
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  };
}> = ({ version, urlParams }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          target="_blank"
          rel="noopener noreferrer"
          href={urls
            .workspace(urlParams.workspaceSlug)
            .system(urlParams.systemSlug)
            .deployment(urlParams.deploymentSlug)
            .release(version.id)
            .jobs()}
        >
          <div className="cursor-pointer truncate underline-offset-2 hover:underline">
            {version.tag}
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="p-2" align="start">
        <pre>{version.tag}</pre>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
