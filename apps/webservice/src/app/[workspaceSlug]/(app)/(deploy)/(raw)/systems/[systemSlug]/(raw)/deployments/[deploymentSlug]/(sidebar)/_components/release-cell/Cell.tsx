import React from "react";
import Link from "next/link";

export const Cell: React.FC<{
  Icon: React.ReactNode;
  url: string;
  tag: string;
  label: string;
  Dropdown?: React.ReactNode;
}> = ({ Icon, url, tag, label, Dropdown }) => (
  <div className="flex h-full w-full items-center justify-center p-1">
    <Link href={url} className="flex w-full items-center gap-2 rounded-md p-2">
      {Icon}
      <div className="flex flex-col">
        <div className="max-w-36 truncate font-semibold">{tag}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
    {Dropdown != null && Dropdown}
  </div>
);
