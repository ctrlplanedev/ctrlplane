"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TbBulb } from "react-icons/tb";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/react";

type GithubAddOrgDialogProps = {
  githubUser?: {
    githubUserId: number;
    userId: string;
  };
  children: React.ReactNode;
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
  workspaceId: string;
  workspaceSlug: string;
};

export const GithubAddOrgDialog: React.FC<GithubAddOrgDialogProps> = ({
  githubUser,
  children,
  githubConfig,
  workspaceId,
}) => {
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const githubOrgs = api.github.organizations.byGithubUserId.useQuery(
    githubUser?.githubUserId ?? 0,
  );
  const router = useRouter();
  const githubOrgsInstalled =
    api.github.organizations.list.useQuery(workspaceId);

  const validOrgsToAdd =
    githubOrgs.data?.filter(
      (org) =>
        !githubOrgsInstalled.data?.some(
          (o) => o.organizationName === org.login,
        ),
    ) ?? [];

  const githubOrgCreate = api.github.organizations.create.useMutation();

  const [image, setImage] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);

  const handlePreconnectedOrgSave = () => {
    if (value == null) return;
    const org = validOrgsToAdd.find((o) => o.login === value);
    if (org == null) return;

    githubOrgCreate
      .mutateAsync({
        installationId: org.installationId,
        workspaceId,
        organizationName: org.login,
        addedByUserId: githubUser?.userId ?? "",
        avatarUrl: org.avatar_url,
      })
      .then(() => router.refresh());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex flex-col px-0">
        <div className="flex flex-col gap-4 px-4">
          <DialogHeader>
            <DialogTitle>Connect a new Organization</DialogTitle>
            <DialogDescription>
              Install the Github app on the organization to connect it to your
              workspace.
            </DialogDescription>
          </DialogHeader>

          <Link
            href={`${githubConfig.url}/apps/${githubConfig.botName}/installations/select_target`}
          >
            <Button variant="outline">Connect Organization</Button>
          </Link>
        </div>

        {validOrgsToAdd.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="flex flex-col gap-4 px-4">
              <DialogHeader>
                <DialogTitle>
                  Select from pre-connected organizations
                </DialogTitle>
                <DialogDescription>
                  <div
                    className="relative mb-4 flex w-fit flex-col gap-2 rounded-md bg-neutral-800/50 px-4 py-3 text-muted-foreground"
                    role="alert"
                  >
                    <TbBulb className="h-6 w-6 flex-shrink-0" />
                    <span className="text-sm">
                      These organizations already have the Github application
                      installed, so you can simply add them to your workspace to
                      unlock agent configuration and config file syncing. Read
                      more{" "}
                      <Link
                        href="https://docs.ctrlplane.dev/integrations/github/github-bot"
                        className="underline"
                        target="_blank"
                      >
                        here
                      </Link>
                      .
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className=" items-center justify-start py-5"
                  >
                    <div className="flex h-10 items-center gap-2">
                      {image !== null && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={image} />
                          <AvatarFallback>{value?.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                      )}

                      <span className=" overflow-hidden text-ellipsis">
                        {value ?? "Select organization..."}
                      </span>
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[466px] p-0">
                  <Command>
                    <CommandInput placeholder="Search organization..." />
                    <CommandGroup>
                      <CommandList>
                        {validOrgsToAdd.map(({ id, login, avatar_url }) => (
                          <CommandItem
                            key={id}
                            value={login}
                            onSelect={(currentValue) => {
                              setValue(currentValue);
                              setImage(avatar_url);
                              setPopoverOpen(false);
                            }}
                            className="w-full cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={avatar_url} />
                                <AvatarFallback>
                                  {login.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              {login}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        <DialogFooter className="px-4">
          <Button
            onClick={handlePreconnectedOrgSave}
            disabled={value == null || githubOrgCreate.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
