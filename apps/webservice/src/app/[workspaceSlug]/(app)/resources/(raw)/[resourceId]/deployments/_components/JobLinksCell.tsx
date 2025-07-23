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
  job: { links: Record<string, string> | null };
};

export const JobLinksCell: React.FC<JobLinksCellProps> = ({ job }) => {
  const { links } = job;
  if (links == null) return <TableCell />;

  const numLinks = Object.keys(links).length;
  if (numLinks <= 3)
    return (
      <TableCell className="py-0">
        <div className="flex flex-wrap gap-2">
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
                "h-6 max-w-24 gap-1 truncate px-2 py-0",
              )}
            >
              <IconExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </TableCell>
    );

  const firstThreeLinks = Object.entries(links).slice(0, 3);
  const remainingLinks = Object.entries(links).slice(3);

  return (
    <TableCell className="py-0">
      <div className="flex flex-wrap gap-2">
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
              "h-6 max-w-24 gap-1 truncate px-2 py-0",
            )}
          >
            <IconExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
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

export const CondensedJobLinksCell: React.FC<JobLinksCellProps> = ({ job }) => {
  const { links } = job;
  if (links == null)
    return <TableCell className="text-muted-foreground">No links</TableCell>;

  const numLinks = Object.keys(links).length;

  return (
    <TableCell className="py-0">
      <div className="flex flex-wrap gap-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="secondary" size="sm" className="h-6">
              {numLinks} links
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            className="flex max-w-40 flex-col gap-1 p-2"
            align="start"
          >
            {Object.entries(links).map(([label, url]) => (
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
