"use client";

import { useState } from "react";

import { TableRow } from "@ctrlplane/ui/table";

export const CollapsibleRow: React.FC<{
  Heading: React.FC<{ isExpanded: boolean }>;
  isInitiallyExpanded?: boolean;
  DropdownMenu?: React.ReactNode;
  children: React.ReactNode;
}> = ({ Heading, isInitiallyExpanded = false, DropdownMenu, children }) => {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

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
