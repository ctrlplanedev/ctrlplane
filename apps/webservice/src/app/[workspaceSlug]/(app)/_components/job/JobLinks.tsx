import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";

import { buttonVariants } from "@ctrlplane/ui/button";

export const JobLinks: React.FC<{
  links: Record<string, string>;
}> = ({ links }) => (
  <div className="flex items-center gap-1">
    {Object.entries(links).length === 0 && (
      <span className="text-sm text-muted-foreground">No links</span>
    )}
    {Object.entries(links).map(([label, url]) => (
      <Link
        key={label}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({
          variant: "secondary",
          size: "xs",
          className: "gap-1",
        })}
      >
        <IconExternalLink className="h-4 w-4" />
        {label}
      </Link>
    ))}
  </div>
);
