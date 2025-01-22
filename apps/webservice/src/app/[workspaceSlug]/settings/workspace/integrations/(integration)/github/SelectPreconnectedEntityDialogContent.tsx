import type { GithubUser } from "@ctrlplane/db/schema";
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

type PreconnectedEntityComboboxProps = {
  githubEntities: {
    installationId: number;
    type: "user" | "organization";
    slug: string;
    avatarUrl: string;
  }[];
  githubUser: GithubUser;
  workspaceId: string;
  onNavigateBack: () => void;
  onSave: () => void;
};

export const SelectPreconnectedEntityDialogContent: React.FC<
  PreconnectedEntityComboboxProps
> = ({ githubEntities, workspaceId, onNavigateBack, onSave }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const router = useRouter();
  const utils = api.useUtils();

  const githubEntityCreate = api.github.entities.create.useMutation();

  const handleSave = async () => {
    if (value == null) return;
    const entity = githubEntities.find((e) => e.slug === value);
    if (entity == null) return;

    await githubEntityCreate.mutateAsync({
      ...entity,
      workspaceId,
    });

    onSave();
    router.refresh();
    utils.job.agent.byWorkspaceId.invalidate(workspaceId);
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
                {githubEntities.map(({ slug, avatarUrl }) => (
                  <CommandItem
                    key={slug}
                    value={slug}
                    onSelect={(currentValue) => {
                      setValue(currentValue);
                      setImage(avatarUrl);
                      setOpen(false);
                    }}
                    className="w-full cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback>{slug.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      {slug}
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
            disabled={value == null || githubEntityCreate.isPending}
          >
            Connect
          </Button>
        </div>
      </DialogFooter>
    </>
  );
};
