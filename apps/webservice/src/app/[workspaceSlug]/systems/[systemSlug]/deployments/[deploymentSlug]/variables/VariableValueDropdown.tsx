import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { VariableValue } from "./variable-data";
import { api } from "~/trpc/react";
import { TargetConditionDialog } from "../../../../../_components/target-condition/TargetConditionDialog";

export const VariableValueDropdown: React.FC<{
  value: VariableValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const update = api.deployment.variable.value.update.useMutation();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <TargetConditionDialog
            condition={value.targetFilter ?? undefined}
            onChange={(condition) =>
              update
                .mutateAsync({
                  id: value.id,
                  data: { targetFilter: condition },
                })
                .then(() => {
                  router.refresh();
                })
            }
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Assign targets
            </DropdownMenuItem>
          </TargetConditionDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
