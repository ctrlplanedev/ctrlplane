"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconExternalLink,
  IconInfoCircle,
  IconProgress,
} from "@tabler/icons-react";

import { buttonVariants } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { OverviewContent } from "./OverviewContent";

const param = "release_id";
export const useReleaseDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const releaseId = params.get(param);

  const setReleaseId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeReleaseId = () => setReleaseId(null);

  return { releaseId, setReleaseId, removeReleaseId };
};

export const ReleaseDrawer: React.FC = () => {
  const { releaseId, removeReleaseId } = useReleaseDrawer();
  const isOpen = releaseId != null && releaseId != "";
  const setIsOpen = removeReleaseId;
  const releaseQ = api.deployment.version.byId.useQuery(releaseId ?? "", {
    enabled: isOpen,
    refetchInterval: 10_000,
  });
  const release = releaseQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  const links =
    release?.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(release.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none focus-visible:outline-none"
      >
        <div className="border-b p-6">
          <div className="flex items-center">
            <DrawerTitle className="flex-grow">{release?.name}</DrawerTitle>
          </div>
          {release != null && links != null && (
            <div className="mt-3 flex flex-wrap gap-2">
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
            </div>
          )}
        </div>
        <div className="flex w-full gap-6 p-6">
          <div className="space-y-1">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={<IconInfoCircle className="h-4 w-4" />}
              label="Overview"
            />
            <TabButton
              active={activeTab === "jobs"}
              onClick={() => setActiveTab("jobs")}
              icon={<IconProgress className="h-4 w-4" />}
              label="Jobs"
            />
          </div>

          {release != null && (
            <div className="w-full overflow-auto">
              {activeTab === "overview" && (
                <OverviewContent release={release} />
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
