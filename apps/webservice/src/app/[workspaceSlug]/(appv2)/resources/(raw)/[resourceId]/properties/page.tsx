import { notFound } from "next/navigation";
import { format } from "date-fns";
import * as yaml from "js-yaml";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { MetadataInfo } from "~/app/[workspaceSlug]/(appv2)/_components/MetadataInfo";
import { api } from "~/trpc/server";
import { ConfigEditor } from "./ConfigEditor";

const ResourceConfigInfo: React.FC<{ config: Record<string, any> }> = ({
  config,
}) => <ConfigEditor value={yaml.dump(config)} readOnly />;

export default async function PropertiesPage(props: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await props.params;
  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  const links =
    resource.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;

  return (
    <div className="container space-y-4 p-8">
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
                    ID
                  </td>
                  <td>{resource.id}</td>
                </tr>
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
          <MetadataInfo metadata={resource.metadata} />
        </div>
      </div>
    </div>
  );
}
