import type * as schema from "@ctrlplane/db/schema";
import { format } from "date-fns";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

export const ResourceProperties: React.FC<{
  resource: schema.Resource & {
    provider: schema.ResourceProvider | null;
    metadata: Record<string, string>;
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
      <div className="text-2xl font-semibold">Properties</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <table
            width="100%"
            className="text-xs"
            style={{ tableLayout: "fixed" }}
          >
            <tbody>
              <tr>
                <td className="w-[110px] p-1 pr-2 text-muted-foreground">ID</td>
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
                            The next resource provider to insert a resource with
                            the same identifier will become the owner of this
                            resource.
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
  );
};
