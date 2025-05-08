"use client";

import { useState } from "react";

import { TableRow } from "@ctrlplane/ui/table";

export const CollapsibleRow: React.FC<{
  Heading: React.FC<{ isExpanded: boolean }>;
  DropdownMenu?: React.ReactNode;
  children: React.ReactNode;
}> = ({ Heading, DropdownMenu, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <TableRow className="sticky" onClick={() => setIsExpanded((t) => !t)}>
        <Heading isExpanded={isExpanded} />
        {DropdownMenu != null && DropdownMenu}
      </TableRow>
      {isExpanded && children}
    </>
  );
};
