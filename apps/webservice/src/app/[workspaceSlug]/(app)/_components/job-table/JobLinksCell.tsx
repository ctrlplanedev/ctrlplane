"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { TableCell } from "@ctrlplane/ui/table";

type JobLinksCellProps = {
  linksMetadata?: SCHEMA.JobMetadata;
};

export const JobLinksCell: React.FC<JobLinksCellProps> = ({
  linksMetadata,
}) => {
  const links =
    linksMetadata != null
      ? (JSON.parse(linksMetadata.value) as Record<string, string>)
      : null;

  if (links == null) return <TableCell />;

  const numLinks = Object.keys(links).length;
  if (numLinks <= 3)
    return (
      <TableCell className="py-0">
        <div
          className="flex flex-wrap gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {Object.entries(links).map(([label, url]) => (
            <Link
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({
                  variant: "secondary",
                  size: "sm",
                }),
                "h-6 max-w-20 gap-1 truncate px-2 py-0",
              )}
            >
              <IconExternalLink className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </TableCell>
    );

  const firstThreeLinks = Object.entries(links).slice(0, 3);
  const remainingLinks = Object.entries(links).slice(3);

  return (
    <TableCell className="py-0">
      <div
        className="flex flex-wrap gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {firstThreeLinks.map(([label, url]) => (
          <Link
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({
                variant: "secondary",
                size: "sm",
              }),
              "h-6 max-w-20 gap-1 truncate px-2 py-0",
            )}
          >
            <IconExternalLink className="h-4 w-4" />
            {label}
          </Link>
        ))}
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6">
              +{remainingLinks.length} more
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            className="flex max-w-40 flex-col gap-1 p-2"
            align="start"
          >
            {remainingLinks.map(([label, url]) => (
              <Link
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm underline-offset-1 hover:underline"
              >
                {label}
              </Link>
            ))}
          </HoverCardContent>
        </HoverCard>
      </div>
    </TableCell>
  );
};
