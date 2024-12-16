"use client";

import type { Resource, ResourceProvider } from "@ctrlplane/db/schema";
import { IconSparkles } from "@tabler/icons-react";
import { format } from "date-fns";
import yaml from "js-yaml";

import { Input } from "@ctrlplane/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";
import { ConfigEditor } from "../ConfigEditor";

const ResourceConfigInfo: React.FC<{ config: Record<string, any> }> = ({
  config,
}) => <ConfigEditor value={yaml.dump(config)} readOnly />;

const ResourceMetadataInfo: React.FC<{ metadata: Record<string, string> }> = (
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
        <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 max-h-[250px] overflow-auto rounded-b-lg border-x border-b p-1.5">
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

export const OverviewContent: React.FC<{
  resource: Resource & {
    metadata: Record<string, string>;
    provider: ResourceProvider | null;
  };
}> = ({ resource }) => {
  const links =
    resource.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
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
                <tr>
                  <td className="w-[110px] p-1 pr-2 text-muted-foreground">
                    Identifier
                  </td>
                  <td>{resource.identifier}</td>
                </tr>
                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Name</td>
                  <td>{resource.name}</td>
                </tr>
                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Version</td>
                  <td>{resource.version}</td>
                </tr>
                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Kind</td>
                  <td>{resource.kind}</td>
                </tr>
                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">
                    Resource Provider
                  </td>
                  <td>
                    {resource.provider != null ? (
                      resource.provider.name
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="cursor-help italic text-gray-500">
                              Not set
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[250px]">
                              The next resource provider to insert a resource
                              with the same identifier will become the owner of
                              this resource.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Last Sync</td>
                  <td>
                    {resource.updatedAt &&
                      format(resource.updatedAt, "MM/dd/yyyy mm:hh:ss")}
                  </td>
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
                <tr>
                  <td className="w-[110px] p-1 pr-2 text-muted-foreground">
                    External ID
                  </td>
                  <td>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {resource.metadata[ReservedMetadataKey.ExternalId] ?? (
                        <span className="cursor-help italic text-gray-500">
                          Not set
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm">Config</div>
        <div className="text-xs">
          <ResourceConfigInfo config={resource.config} />
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm">
          Metadata ({Object.keys(resource.metadata).length})
        </div>
        <div className="text-xs">
          <ResourceMetadataInfo metadata={resource.metadata} />
        </div>
      </div>
    </div>
  );
};
