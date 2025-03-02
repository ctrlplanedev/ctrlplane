import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DeleteEnvironmentDialog } from "./DeleteEnvironmentDialog";

type EnvironmentDropdownProps = {
  environment: SCHEMA.Environment;
  children: React.ReactNode;
};

export const EnvironmentDropdown: React.FC<EnvironmentDropdownProps> = ({
  environment,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DeleteEnvironmentDialog environment={environment}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2 text-red-500"
          >
            <IconTrash className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DeleteEnvironmentDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
