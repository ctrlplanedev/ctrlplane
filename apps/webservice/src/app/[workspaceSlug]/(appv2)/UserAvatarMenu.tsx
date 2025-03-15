"use client";

import Link from "next/link";
import { IconLogout, IconSettings, IconUser } from "@tabler/icons-react";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

type UserAvatarMenuProps = {
  workspaceSlug: string;
  viewer: {
    email: string;
    image?: string | null;
    name?: string | null;
  };
};

export const UserAvatarMenu = ({
  workspaceSlug,
  viewer,
}: UserAvatarMenuProps) => {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-7 cursor-pointer transition-all hover:ring-2 hover:ring-primary/20">
          <AvatarImage
            src={viewer.image ?? undefined}
            alt={viewer.name || viewer.email}
          />
          <AvatarFallback>
            <IconUser className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{viewer.name || "User"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {viewer.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <Link href={`/${workspaceSlug}/settings/account/profile`}>
          <DropdownMenuItem className="cursor-pointer">
            <IconSettings className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={handleSignOut}
        >
          <IconLogout className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAvatarMenu;
