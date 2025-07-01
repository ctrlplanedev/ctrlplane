import React from "react";
import Link from "next/link";
import { IconPinFilled } from "@tabler/icons-react";

export const Cell: React.FC<{
  Icon: React.ReactNode;
  url: string;
  tag: string;
  label: string;
  isVersionPinned?: boolean;
  Dropdown?: React.ReactNode;
}> = ({ Icon, url, tag, label, isVersionPinned = false, Dropdown }) => (
  <div className="flex h-full w-full items-center justify-center p-1">
    <Link href={url} className="flex w-full items-center gap-2 rounded-md p-2">
      {Icon}
      <div className="flex flex-col">
        <div className="flex max-w-36 items-center gap-1 truncate font-semibold">
          {isVersionPinned && (
            <IconPinFilled className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{tag}</span>
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
    {Dropdown != null && Dropdown}
  </div>
);
