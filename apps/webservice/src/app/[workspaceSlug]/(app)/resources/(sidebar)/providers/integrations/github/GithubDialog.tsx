"use client";

import type React from "react";
import { useState } from "react";
import {
  IconBrandGithub,
  IconLoader2,
  IconSelector,
} from "@tabler/icons-react";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/react";

const formSchema = z.object({
  name: z.string(),
  repositoryId: z.number(),
  entityId: z.string().uuid(),
});

type GithubDialogProps = {
  workspaceId: string;
  children: React.ReactNode;
};

export const GithubDialog: React.FC<GithubDialogProps> = ({
  workspaceId,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const form = useForm({ schema: formSchema });

  const entityId = form.watch("entityId");

  const { data: entities, isLoading: isEntitiesLoading } =
    api.github.entities.list.useQuery(workspaceId);
  const selectedEntity = entities?.find((e) => e.id === entityId);
  const { data: repos, isLoading: isReposLoading } =
    api.github.entities.repos.list.useQuery(
      {
        owner: selectedEntity?.slug ?? "",
        installationId: selectedEntity?.installationId ?? 0,
        workspaceId,
      },
      { enabled: selectedEntity != null },
    );
  const repoId = form.watch("repositoryId");
  const selectedRepo = repos?.find((r) => r.id === repoId);

  const createProvider =
    api.resource.provider.managed.github.create.useMutation();
  const onSubmit = form.handleSubmit((data) =>
    createProvider
      .mutateAsync({
        workspaceId,
        entityId: data.entityId,
        repositoryId: data.repositoryId,
        name: data.name,
      })
      .then(() => setOpen(false)),
  );

  const [entityOpen, setEntityOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Github Repo Provider</DialogTitle>
          <DialogDescription>
            Add a Github Repo provider to your workspace using any of the github
            entities connected to your workspace. The github provider will sync
            your pull requests as resources in Ctrlplane.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <FormLabel>Entity</FormLabel>
                  <FormControl>
                    <Popover
                      open={entityOpen}
                      onOpenChange={setEntityOpen}
                      modal
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={entityOpen}
                          className="items-center justify-start gap-2 px-2"
                        >
                          <IconSelector className="h-4 w-4" />
                          {selectedEntity != null
                            ? selectedEntity.slug
                            : "Select organization..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[462px] p-0">
                        <Command>
                          <CommandInput placeholder="Search organization..." />
                          <CommandList className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700">
                            {isEntitiesLoading && (
                              <CommandItem
                                value="Loading..."
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                              >
                                <IconLoader2 className="h-3 w-3 animate-spin" />
                                Loading organizations...
                              </CommandItem>
                            )}
                            {entities?.map((entity) => (
                              <CommandItem
                                key={entity.id}
                                value={entity.slug}
                                onSelect={() => {
                                  field.onChange(entity.id);
                                  setEntityOpen(false);
                                }}
                              >
                                <Avatar className="mr-2 size-4">
                                  <AvatarImage src={entity.avatarUrl ?? ""} />
                                  <AvatarFallback>
                                    <IconBrandGithub />
                                  </AvatarFallback>
                                </Avatar>
                                {entity.slug}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repositoryId"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <FormLabel>Repository</FormLabel>
                  <FormControl>
                    <Popover open={repoOpen} onOpenChange={setRepoOpen} modal>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={repoOpen}
                          className="items-center justify-start gap-2 px-2"
                        >
                          <IconSelector className="h-4 w-4" />
                          {selectedRepo != null
                            ? selectedRepo.name
                            : "Select repository..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[462px] p-0">
                        <Command>
                          <CommandInput placeholder="Search repository..." />
                          <CommandList className="scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700">
                            {isReposLoading && (
                              <CommandItem
                                value="Loading..."
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                              >
                                <IconLoader2 className="h-3 w-3 animate-spin" />
                                Loading repositories...
                              </CommandItem>
                            )}
                            {repos?.map((repo) => (
                              <CommandItem
                                key={repo.id}
                                value={repo.name}
                                onSelect={() => {
                                  field.onChange(repo.id);
                                  setRepoOpen(false);
                                }}
                              >
                                {repo.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={createProvider.isPending}>
              Create
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
