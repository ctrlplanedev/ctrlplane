"use client";

import { IconPin, IconPinnedOff } from "@tabler/icons-react";

import { DropdownMenuItem } from "@ctrlplane/ui/dropdown-menu";

import { PinEnvToVersionDialog } from "./PinEnvToVersionDialog";
import { UnpinEnvFromVersionDialog } from "./UnpinEnvFromVersionDialog";

export const VersionPinningDropdownItems: React.FC<{
  environment: { id: string; name: string };
  version: { id: string; tag: string };
  isVersionPinned: boolean;
}> = ({ environment, version, isVersionPinned }) => {
  return (
    <>
      {isVersionPinned && (
        <UnpinEnvFromVersionDialog environment={environment} version={version}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconPinnedOff className="h-4 w-4" />
            Unpin version
          </DropdownMenuItem>
        </UnpinEnvFromVersionDialog>
      )}
      {!isVersionPinned && (
        <PinEnvToVersionDialog environment={environment} version={version}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconPin className="h-4 w-4" />
            Pin version
          </DropdownMenuItem>
        </PinEnvToVersionDialog>
      )}
    </>
  );
};
