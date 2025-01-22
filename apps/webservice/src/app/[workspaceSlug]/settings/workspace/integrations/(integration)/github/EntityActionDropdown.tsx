import type * as schema from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconChevronDown, IconExternalLink } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { DisconnectDropdownActionButton } from "./DisconnectDropdownActionButton";
import { GithubRemoveEntityDialog } from "./GithubRemoveEntityDialog";

type EntityActionDropdownProps = {
  githubConfig: { url: string; botName: string; clientId: string };
  entity: schema.GithubEntity;
};

export const EntityActionDropdown: React.FC<EntityActionDropdownProps> = ({
  githubConfig,
  entity,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Connected
          <IconChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <Link
          href={`${githubConfig.url}/organizations/${entity.slug}/settings/installations/${entity.installationId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <DropdownMenuItem>
            Configure <IconExternalLink className="ml-2 h-4 w-4" />
          </DropdownMenuItem>
        </Link>

        <GithubRemoveEntityDialog githubEntity={entity}>
          <DisconnectDropdownActionButton />
        </GithubRemoveEntityDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
