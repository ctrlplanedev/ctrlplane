import { notFound } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";
import { format } from "date-fns";
import yaml from "js-yaml";

import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { ConfigEditor } from "~/app/[workspaceSlug]/(app)/_components/ConfigEditor";
import { MetadataInfo } from "~/app/[workspaceSlug]/(app)/_components/MetadataInfo";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";

export default async function PropertiesPage(props: {
  params: Promise<{ releaseId: string }>;
}) {
  const { releaseId: versionId } = await props.params;

  const version = await api.deployment.version.byId(versionId);
  if (version == null) notFound();

  const { metadata } = version;
  const links =
    metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;
  return (
    <div className="overflow-auto p-2">
      <div className="flex items-center gap-2">
        <SidebarTrigger name={Sidebars.Release}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <div className="text-sm">Properties</div>
      </div>
      <div className="space-y-4 px-8 py-4">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <table
              width="100%"
              className="text-xs"
              style={{ tableLayout: "fixed" }}
            >
              <tbody>
                {version.name !== version.tag && (
                  <tr>
                    <td className="p-1 pr-2 text-muted-foreground">Name</td>
                    <td>{version.name}</td>
                  </tr>
                )}

                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Version</td>
                  <td>{version.tag}</td>
                </tr>

                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">Created At</td>
                  <td>{format(version.createdAt, "MM/dd/yyyy mm:hh:ss")}</td>
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
        </div>

        <div>
          <div className="mb-2 text-sm">Config</div>
          <div className="text-xs">
            <ConfigEditor value={yaml.dump(version.config)} readOnly />
          </div>
        </div>

        {Object.keys(metadata).length !== 0 && (
          <div>
            <div className="mb-2 text-sm">
              Metadata ({Object.keys(metadata).length})
            </div>
            <div className="text-xs">
              <MetadataInfo metadata={metadata} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
