import React, { useState } from "react";
import { IconAdjustmentsExclamation } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { OverrideJobStatusDialog } from "~/app/[workspaceSlug]/(app)/_components/job/JobDropdownMenu";

export const EnvironmentRowDropdown: React.FC<{
  jobIds: string[];
  children: React.ReactNode;
}> = ({ jobIds, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <OverrideJobStatusDialog jobIds={jobIds} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="space-x-2"
          >
            <IconAdjustmentsExclamation size={16} />
            <p>Override Job Status</p>
          </DropdownMenuItem>
        </OverrideJobStatusDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
