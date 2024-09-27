import type { DeploymentVariable } from "@ctrlplane/db/schema";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { AddVariableValueDialog } from "./AddVariableValueDialog";

export const VariableDropdown: React.FC<{
  variable: DeploymentVariable;
  children: React.ReactNode;
}> = ({ variable, children }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <AddVariableValueDialog variable={variable}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Add Value
            </DropdownMenuItem>
          </AddVariableValueDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
