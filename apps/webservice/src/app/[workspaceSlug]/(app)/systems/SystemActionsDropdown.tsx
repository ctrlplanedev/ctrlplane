"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconSettings, IconTarget, IconTrash } from "@tabler/icons-react";
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
  ResourceFilterType,
  ResourceOperator,
} from "@ctrlplane/validators/resources";

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
    .map((env) => env.resourceFilter)
    .filter(isPresent);
  const filter: ResourceCondition = {
    type: ResourceFilterType.Comparison,
    operator: ResourceOperator.Or,
    conditions: envFilters,
  };
  const hash = LZString.compressToEncodedURIComponent(JSON.stringify(filter));
  const url = `/${workspaceSlug}/resources?filter=${hash}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <Link href={url}>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconTarget className="h-4 w-4 text-muted-foreground" />
              View resources
            </DropdownMenuItem>
          </Link>
          <EditSystemDialog system={system}>
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconSettings className="h-4 w-4 text-muted-foreground" />
              Settings
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
