import Link from "next/link";
import { TbChevronDown, TbExternalLink } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { GithubOrganizationWithConfigFiles } from "./GithubRemoveOrgDialog";
import { DisconnectDropdownActionButton } from "./DisconnectDropdownActionButton";
import { GithubRemoveOrgDialog } from "./GithubRemoveOrgDialog";

type OrgActionDropdownProps = {
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
  org: GithubOrganizationWithConfigFiles;
};

export const OrgActionDropdown: React.FC<OrgActionDropdownProps> = ({
  githubConfig,
  org,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Connected
          <TbChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <Link
          href={`${githubConfig.url}/organizations/${org.organizationName}/settings/installations/${org.installationId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <DropdownMenuItem>
            Configure <TbExternalLink className="ml-2 h-4 w-4" />
          </DropdownMenuItem>
        </Link>

        <GithubRemoveOrgDialog githubOrganization={org}>
          <DisconnectDropdownActionButton />
        </GithubRemoveOrgDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
