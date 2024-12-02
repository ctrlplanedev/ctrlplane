"use client";

import type React from "react";
import Link from "next/link";
import {
  IconDotsVertical,
  IconExternalLink,
  IconLoader2,
  IconRocket,
} from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { JobDropdownMenu } from "~/app/[workspaceSlug]/(app)/systems/[systemSlug]/deployments/[deploymentSlug]/releases/[versionId]/JobDropdownMenu";
import { useReleaseChannel } from "~/app/[workspaceSlug]/(app)/systems/[systemSlug]/deployments/[deploymentSlug]/releases/[versionId]/useReleaseChannel";
import { api } from "~/trpc/react";
import { JobAgent } from "./JobAgent";
import { JobMetadata } from "./JobMetadata";
import { JobPropertiesTable } from "./JobProperties";
import { JobVariables } from "./JobVariables";
import { useJobDrawer } from "./useJobDrawer";

export const JobDrawer: React.FC = () => {
  const { jobId, removeJobId } = useJobDrawer();
  const isOpen = jobId != null && jobId != "";
  const setIsOpen = removeJobId;

  const jobQ = api.job.config.byId.useQuery(jobId ?? "", {
    enabled: isOpen,
    refetchInterval: 10_000,
  });
  const job = jobQ.data;
  const linksMetadata = job?.job.metadata.find(
    (m) => m.key === String(ReservedMetadataKey.Links),
  );

  const links =
    linksMetadata != null
      ? (JSON.parse(linksMetadata.value) as Record<string, string>)
      : null;

  const { isPassingReleaseChannel, loading: releaseChannelLoading } =
    useReleaseChannel(
      job?.release.deployment.id ?? "",
      job?.environmentId ?? "",
      job?.release.version ?? "",
      jobQ.isSuccess,
    );

  const loading = jobQ.isLoading || releaseChannelLoading;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none focus-visible:outline-none"
      >
        {loading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {!jobQ.isLoading && (
          <>
            <DrawerTitle className="border-b p-6">
              <div className="flex items-center gap-2 ">
                <div className="flex flex-shrink-0 items-center gap-2 rounded bg-blue-500/20 p-1 text-blue-400">
                  <IconRocket className="h-4 w-4" />
                </div>
                Job
                {job != null && (
                  <JobDropdownMenu
                    release={job.release}
                    environmentId={job.environment.id}
                    target={job.resource}
                    deployment={job.release.deployment}
                    job={job.job}
                    isPassingReleaseChannel={isPassingReleaseChannel}
                  >
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <IconDotsVertical className="h-3 w-3" />
                    </Button>
                  </JobDropdownMenu>
                )}
              </div>
              {links != null && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <>
                    {Object.entries(links).map(([label, url]) => (
                      <Link
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({
                          variant: "secondary",
                          size: "sm",
                          className: "gap-1",
                        })}
                      >
                        <IconExternalLink className="h-4 w-4" />
                        {label}
                      </Link>
                    ))}
                  </>
                </div>
              )}
            </DrawerTitle>
            {job != null && (
              <div className="flex h-full flex-col gap-6 p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-1">
                    <JobPropertiesTable job={job} />
                  </div>
                  <div className="col-span-1">
                    <JobAgent job={job} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-1">
                    <JobVariables job={job} />
                  </div>
                  <div className="col-span-1">
                    <JobMetadata job={job} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
