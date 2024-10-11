"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconEdit, IconTarget, IconTrash } from "@tabler/icons-react";
import LZString from "lz-string";
import { isPresent } from "ts-is-present";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  TargetFilterType,
  TargetOperator,
} from "@ctrlplane/validators/targets";

import { DeleteSystemDialog } from "./[systemSlug]/_components/DeleteSystemDialog";
import { EditSystemDialog } from "./[systemSlug]/_components/EditSystemDialog";

type SystemActionsDropdownProps = {
  system: schema.System & { environments: schema.Environment[] };
  children: React.ReactNode;
};

export const SystemActionsDropdown: React.FC<SystemActionsDropdownProps> = ({
  system,
  children,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const envFilters = system.environments
    .map((env) => env.targetFilter)
    .filter(isPresent);
  const filter: TargetCondition = {
    type: TargetFilterType.Comparison,
    operator: TargetOperator.Or,
    conditions: envFilters,
  };
  const hash = LZString.compressToEncodedURIComponent(JSON.stringify(filter));
  const url = `/${workspaceSlug}/targets?filter=${hash}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <Link href={url}>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconTarget className="h-4 w-4 text-muted-foreground" />
              View targets
            </DropdownMenuItem>
          </Link>
          <EditSystemDialog system={system}>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconEdit className="h-4 w-4 text-muted-foreground" />
              Edit
            </DropdownMenuItem>
          </EditSystemDialog>
          <DeleteSystemDialog system={system}>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconTrash className="h-4 w-4 text-red-400" />
              Delete
            </DropdownMenuItem>
          </DeleteSystemDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
