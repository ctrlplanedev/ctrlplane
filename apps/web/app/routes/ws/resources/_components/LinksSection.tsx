import { ExternalLink } from "lucide-react";

import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { useResource } from "./ResourceProvider";

export function LinksSection() {
  const { resource } = useResource();

  const links =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    resource.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : {};

  if (Object.keys(links).length === 0) return null;

  return (
    <>
      {Object.entries(links).map(([name, url]) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {name}
        </a>
      ))}
    </>
  );
}
