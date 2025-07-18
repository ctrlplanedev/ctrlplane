import Link from "next/link";
import { IconCopy, IconExternalLink } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { toast } from "@ctrlplane/ui/toast";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import type { ResourceInformation } from "../types";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";

const ResourceLinks: React.FC<{ resource: ResourceInformation }> = ({
  resource,
}) => {
  const { metadata } = resource;
  const links =
    metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;

  return (
    <>
      {Object.entries(links ?? {}).map(([key, value]) => (
        <Link
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          key={key}
          className={cn(
            "flex items-center gap-2 text-sm",
            buttonVariants({ variant: "outline", size: "sm" }),
          )}
        >
          <IconExternalLink className="size-4" /> {key}
        </Link>
      ))}
    </>
  );
};

const ResourceExternalId: React.FC<{ resource: ResourceInformation }> = ({
  resource,
}) => {
  const { metadata } = resource;
  const externalId = metadata[ReservedMetadataKey.ExternalId];
  const [, copy] = useCopyToClipboard();

  const handleCopy = () => {
    if (externalId == null) return;
    copy(externalId);
    toast.success("External ID copied to clipboard");
  };

  if (externalId == null) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="flex items-center gap-2"
    >
      <IconCopy className="size-4" />
      External ID
    </Button>
  );
};

export const ResourceDrawerHeader: React.FC<{
  resource: ResourceInformation;
}> = ({ resource }) => {
  return (
    <div className="border-b pb-4">
      <div className="flex items-center gap-2 p-4">
        <ResourceIcon
          version={resource.version}
          kind={resource.kind}
          className="h-10 w-10"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{resource.name}</span>
          <span className="text-xs text-muted-foreground">
            {resource.version}:{resource.kind}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4">
        <ResourceLinks resource={resource} />
        <ResourceExternalId resource={resource} />
      </div>
    </div>
  );
};
