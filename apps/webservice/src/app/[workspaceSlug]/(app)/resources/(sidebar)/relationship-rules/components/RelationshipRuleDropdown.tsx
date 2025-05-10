"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { EditRelationshipDialog } from "./EditRelationshipDialog";

interface RelationshipRuleDropdownProps {
  rule: SCHEMA.ResourceRelationshipRule & {
    metadataKeysMatches: SCHEMA.ResourceRelationshipRuleMetadataMatch[];
    targetMetadataEquals: SCHEMA.ResourceRelationshipRuleMetadataEquals[];
  };
}

export const RelationshipRuleDropdown: React.FC<
  RelationshipRuleDropdownProps
> = ({ rule }) => {
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
        <EditRelationshipDialog rule={rule}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2"
          >
            <IconPencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
        </EditRelationshipDialog>
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 text-destructive"
          onClick={() => deleteRule.mutateAsync(rule.id)}
        >
          <IconTrash className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
