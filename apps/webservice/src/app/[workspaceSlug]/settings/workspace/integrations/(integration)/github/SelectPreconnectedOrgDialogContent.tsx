import type { GithubUser } from "@ctrlplane/db/schema";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { DialogFooter, DialogHeader, DialogTitle } from "@ctrlplane/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

export type GithubOrg =
  RestEndpointMethodTypes["orgs"]["get"]["response"]["data"] & {
    installationId: number;
  };

type PreconnectedOrgsComboboxProps = {
  githubOrgs: GithubOrg[];
  githubUser: GithubUser;
  workspaceId: string;
  onNavigateBack: () => void;
  onSave: () => void;
};

export const SelectPreconnectedOrgDialogContent: React.FC<
  PreconnectedOrgsComboboxProps
> = ({ githubOrgs, githubUser, workspaceId, onNavigateBack, onSave }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const router = useRouter();

  const githubOrgCreate = api.github.organizations.create.useMutation();
  const jobAgentCreate = api.job.agent.create.useMutation();

  const handleSave = async () => {
    if (value == null) return;
    const org = githubOrgs.find((o) => o.login === value);
    if (org == null) return;

    await githubOrgCreate.mutateAsync({
      installationId: org.installationId,
      workspaceId,
      organizationName: org.login,
      addedByUserId: githubUser.userId,
      avatarUrl: org.avatar_url,
    });

    await jobAgentCreate.mutateAsync({
      name: org.login,
      type: "github-app",
      workspaceId,
      config: {
        installationId: org.installationId,
        owner: org.login,
      },
    });

    onSave();
    router.refresh();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Select a pre-connected organization</DialogTitle>
      </DialogHeader>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="items-center justify-start py-5"
          >
            <div className="flex h-10 items-center gap-2">
              {image !== null && (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={image} />
                  <AvatarFallback>{value?.slice(0, 2)}</AvatarFallback>
                </Avatar>
              )}

              <span className="overflow-hidden text-ellipsis">
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
                {githubOrgs.map(({ id, login, avatar_url }) => (
                  <CommandItem
                    key={id}
                    value={login}
                    onSelect={(currentValue) => {
                      setValue(currentValue);
                      setImage(avatar_url);
                      setOpen(false);
                    }}
                    className="w-full cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={avatar_url} />
                        <AvatarFallback>{login.slice(0, 2)}</AvatarFallback>
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

      <DialogFooter className="flex w-full">
        <Button onClick={onNavigateBack} variant="outline">
          Back
        </Button>
        <div className="flex flex-grow justify-end">
          <Button
            className="w-fit"
            onClick={handleSave}
            disabled={value == null || githubOrgCreate.isPending}
          >
            Connect
          </Button>
        </div>
      </DialogFooter>
    </>
  );
};
