import Image from "next/image";
import { notFound } from "next/navigation";
import { IconUser } from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/server";
import { WorkspaceDropdown } from "./WorkspaceDropdown";

export const TopNav: React.FC<{ workspaceSlug: string }> = async ({
  workspaceSlug,
}) => {
  const workspace = await api.workspace.bySlug(workspaceSlug).catch(() => null);
  if (workspace == null) notFound();
  const viewer = await api.user.viewer();
  const workspaces = await api.workspace.list();
  return (
    <nav className="flex h-14 w-full shrink-0 items-center gap-4 bg-neutral-900/40 px-4">
      <div className="ml-3 flex shrink-0 items-center gap-7">
        <Image
          src="/android-chrome-192x192.png"
          alt="Ctrlplane"
          width={24}
          height={24}
        />

        <WorkspaceDropdown workspace={workspace} workspaces={workspaces} />
      </div>

      <div className="mx-auto flex flex-1 justify-center">
        <div className="w-[450px]">
          <Input
            placeholder="Search for resources, systems, deployments, etc."
            className="bg-transparent"
          />
        </div>
      </div>

      <div>
        <Avatar className="size-7">
          <AvatarImage src={viewer.image ?? undefined} />
          <AvatarFallback>
            <IconUser />
          </AvatarFallback>
        </Avatar>
      </div>
    </nav>
  );
};
