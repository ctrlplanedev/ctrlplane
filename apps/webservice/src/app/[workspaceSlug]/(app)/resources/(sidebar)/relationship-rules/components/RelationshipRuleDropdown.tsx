"use client";

import { IconDots } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";

interface RelationshipRuleDropdownProps {
  ruleId: string;
}

export const RelationshipRuleDropdown: React.FC<
  RelationshipRuleDropdownProps
> = ({ ruleId }) => {
  const utils = api.useUtils();
  const deleteRule = api.resource.relationshipRules.delete.useMutation({
    onSuccess: () => {
      utils.resource.relationshipRules.list.invalidate();
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => deleteRule.mutateAsync(ruleId)}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
