import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  IconChartBar,
  IconClipboardCopy,
  IconExternalLink,
  IconLock,
  IconRefresh,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { toast } from "@ctrlplane/ui/toast";

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
  const router = useRouter();
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const basePath = `/${workspaceSlug}/systems/${systemSlug}/environments/${environment.id}`;

  const copyEnvironmentId = () => {
    navigator.clipboard.writeText(environment.id);
    toast.success("Environment ID copied", {
      description: environment.id,
      duration: 2000,
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => router.push(basePath)}
          >
            <IconExternalLink className="h-4 w-4" />
            View Details
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => router.push(`${basePath}/deployments`)}
          >
            <IconChartBar className="h-4 w-4" />
            View Deployments
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => router.push(`${basePath}/resources`)}
          >
            <IconRefresh className="h-4 w-4" />
            View Resources
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => router.push(`${basePath}/settings`)}
          >
            <IconSettings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => router.push(`${basePath}/policies`)}
          >
            <IconLock className="h-4 w-4" />
            Policies
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={copyEnvironmentId}
          >
            <IconClipboardCopy className="h-4 w-4" />
            Copy ID
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

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
