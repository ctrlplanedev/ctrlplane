"use client";

import type { Release, ReleaseDependency } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconInfoCircle,
  IconProgress,
  IconSparkles,
} from "@tabler/icons-react";
import { format } from "date-fns";
import yaml from "js-yaml";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { Input } from "@ctrlplane/ui/input";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { ConfigEditor } from "../ConfigEditor";

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <Button
    onClick={onClick}
    variant="ghost"
    className={cn(
      "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
      active
        ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
        : "text-muted-foreground",
    )}
  >
    {icon}
    {label}
  </Button>
);

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
  const releaseQ = api.release.byId.useQuery(releaseId ?? "", {
    enabled: isOpen,
    refetchInterval: 10_000,
  });
  const release = releaseQ.data;

  const [activeTab, setActiveTab] = useState("overview");

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

const ReleaseConfigInfo: React.FC<{ config: Record<string, any> }> = ({
  config,
}) => {
  yaml.dump(config);
  return <ConfigEditor value={yaml.dump(config)} readOnly />;
};

const OverviewContent: React.FC<{
  release: Release & {
    metadata: Record<string, string>;
    dependencies: ReleaseDependency[];
  };
}> = ({ release }) => {
  const { metadata } = release;
  const links =
    metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm">Properties</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <table
              width="100%"
              className="text-xs"
              style={{ tableLayout: "fixed" }}
            >
              <tbody>
                {release.name !== release.version && (
                  <tr>
                    <td className="p-1 pr-2 text-muted-foreground">Name</td>
                    <td>{release.name}</td>
                  </tr>
                )}

                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Version</td>
                  <td>{release.version}</td>
                </tr>

                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Created At</td>
                  <td>{format(release.createdAt, "MM/dd/yyyy mm:hh:ss")}</td>
                </tr>

                <tr>
                  <td className="p-1 pr-2 align-top text-muted-foreground">
                    Links
                  </td>
                  <td>
                    {links == null ? (
                      <span className="cursor-help italic text-gray-500">
                        Not set
                      </span>
                    ) : (
                      <>
                        {Object.entries(links).map(([name, url]) => (
                          <a
                            key={name}
                            referrerPolicy="no-referrer"
                            href={url}
                            className="inline-block w-full overflow-hidden text-ellipsis text-nowrap text-blue-300 hover:text-blue-400"
                          >
                            {name}
                          </a>
                        ))}
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table
              width="100%"
              className="text-xs"
              style={{ tableLayout: "fixed" }}
            >
              <tbody>
                <tr></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm">Config</div>
        <div className="text-xs">
          <ReleaseConfigInfo config={release.config} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm">
          Metadata ({Object.keys(metadata).length})
        </div>
        <div className="text-xs">
          <ReleaseMetadataInfo metadata={metadata} />
        </div>
      </div>
    </div>
  );
};

const ReleaseMetadataInfo: React.FC<{ metadata: Record<string, string> }> = (
  props,
) => {
  const metadata = Object.entries(props.metadata).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );
  const { search, setSearch, result } = useMatchSorterWithSearch(metadata, {
    keys: ["0", "1"],
  });
  return (
    <div>
      <div className="text-xs">
        <div>
          <Input
            className="w-full rounded-b-none text-xs"
            placeholder="Search ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 max-h-[250px] overflow-auto rounded-b-lg border-x border-b p-1.5">
          {result.map(([key, value]) => (
            <div className="text-nowrap font-mono" key={key}>
              <span>
                {Object.values(ReservedMetadataKey).includes(
                  key as ReservedMetadataKey,
                ) && (
                  <IconSparkles className="inline-block h-3 w-3 text-yellow-300" />
                )}{" "}
              </span>
              <span className="text-red-400">{key}:</span>
              <span className="text-green-300"> {value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
