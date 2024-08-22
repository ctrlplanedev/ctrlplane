import { useState } from "react";
import { TbRecycle, TbRefresh, TbSelector } from "react-icons/tb";
import { z } from "zod";

import { GithubOrganization } from "@ctrlplane/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import { Form, FormField, useForm } from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/react";

interface ConfigFile {
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
}

interface Repo {
  name: string;
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  configFiles: ConfigFile[];
}

const configFileFormSchema = z.object({
  organizationId: z.string(),
  repositoryName: z.string(),
  name: z.string(),
  branch: z.string().optional(),
});

export const GithubConfigFileSync: React.FC<{
  workspaceSlug?: string;
  workspaceId?: string;
  loading: boolean;
}> = ({ workspaceSlug, workspaceId, loading }) => {
  const connectedOrgs = api.github.organizations.list.useQuery(
    workspaceId ?? "",
    { enabled: workspaceId != null },
  );

  const form = useForm({
    schema: configFileFormSchema,
    defaultValues: {
      organizationId: "",
      repositoryName: "",
      branch: undefined,
      name: "",
    },
    mode: "onChange",
  });

  const { organizationId, repositoryName, branch, name } = form.watch();
  const org = connectedOrgs.data?.find(
    (org) => org.github_organization.id === organizationId,
  );

  const repos = api.github.organizations.repos.list.useQuery(
    {
      installationId: org?.github_organization.installationId ?? 0,
      login: org?.github_organization.organizationName ?? "",
    },
    { enabled: organizationId != "" },
  );
  const repo = repos.data?.find((repo) => repo.name === repositoryName);

  const [orgCommandOpen, setOrgCommandOpen] = useState(false);
  const [repoCommandOpen, setRepoCommandOpen] = useState(false);
  const [configFileCommandOpen, setConfigFileCommandOpen] = useState(false);

  const createConfigFile = api.github.configFile.create.useMutation();

  const configFiles = api.github.configFile.list.useQuery(workspaceId ?? "", {
    enabled: workspaceId != null,
  });

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit(async (values) => {
    const configFile = repo?.configFiles.find(
      (configFile) => configFile.name === name,
    );
    if (configFile == null) return;

    await createConfigFile
      .mutateAsync({
        ...values,
        workspaceId: workspaceId ?? "",
        path: configFile.path,
      })
      .then(() => {
        utils.github.configFile.list.invalidate();
      });
  });

  return (
    <Card className="rounded-md">
      <CardHeader className="space-y-2">
        <CardTitle>Sync Github Config File</CardTitle>
        <CardDescription>
          A{" "}
          <code className="rounded-md bg-neutral-800 p-1">ctrlplane.yaml</code>{" "}
          configuration file allows you to manage your Ctrlplane resources from
          github.
        </CardDescription>
      </CardHeader>

      <Separator />

      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex items-center gap-4">
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field: { onChange } }) => (
                <Popover open={orgCommandOpen} onOpenChange={setOrgCommandOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={orgCommandOpen}
                      className="w-52 items-center justify-start gap-2 px-2"
                    >
                      <TbSelector />
                      <span className="overflow-hidden text-ellipsis">
                        {org != null ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={org.github_organization.avatarUrl ?? ""}
                                className="h-6 w-6"
                              />
                              <AvatarFallback className="h-6 w-6">
                                {org.github_organization.organizationName
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {org.github_organization.organizationName}
                          </div>
                        ) : (
                          "Select organization..."
                        )}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0">
                    <Command>
                      <CommandInput placeholder="Search organization..." />
                      <CommandGroup>
                        <CommandList>
                          {connectedOrgs.data?.map((org) => (
                            <CommandItem
                              key={org.github_organization.id}
                              value={org.github_organization.organizationName}
                              onSelect={() => {
                                onChange(org.github_organization.id);
                                setOrgCommandOpen(false);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={org.github_organization.avatarUrl ?? ""}
                                  className="h-6 w-6"
                                />
                                <AvatarFallback className="h-6 w-6">
                                  {org.github_organization.organizationName
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {org.github_organization.organizationName}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />

            <FormField
              control={form.control}
              name="repositoryName"
              render={({ field: { onChange } }) => (
                <Popover
                  open={repoCommandOpen}
                  onOpenChange={setRepoCommandOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={repoCommandOpen}
                      className="w-52 items-center justify-start gap-2 px-2"
                      disabled={org == null}
                    >
                      <TbSelector />
                      <span className="overflow-hidden text-ellipsis">
                        {repo != null ? repo.name : "Select repo..."}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0">
                    <Command>
                      <CommandInput placeholder="Search workflow..." />
                      <CommandGroup>
                        <CommandList>
                          {!repos.isLoading && repos.data?.length === 0 && (
                            <CommandItem disabled>No repos found</CommandItem>
                          )}
                          {repos.isLoading && (
                            <CommandItem disabled>Loading...</CommandItem>
                          )}
                          {repos.data?.map((repo) => (
                            <CommandItem
                              key={repo.id}
                              value={repo.name}
                              onSelect={() => {
                                onChange(repo.name);
                                setRepoCommandOpen(false);
                              }}
                            >
                              {repo.name}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field: { onChange } }) => (
                <Popover
                  open={configFileCommandOpen}
                  onOpenChange={setConfigFileCommandOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={configFileCommandOpen}
                      disabled={repo == null}
                      className="w-52 items-center justify-start gap-2 px-2"
                    >
                      <TbSelector />
                      <span className="overflow-hidden text-ellipsis">
                        {name != "" ? name : "Select config file..."}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0">
                    <Command>
                      <CommandInput placeholder="Search config file..." />
                      <CommandGroup>
                        <CommandList>
                          {repo?.configFiles.length === 0 && (
                            <CommandItem disabled>
                              No config files found
                            </CommandItem>
                          )}
                          {repo?.configFiles.map((configFile) => (
                            <CommandItem
                              key={configFile.name}
                              value={configFile.name}
                              onSelect={() => {
                                onChange(configFile.name);
                                setConfigFileCommandOpen(false);
                              }}
                            >
                              {configFile.name}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />

            <FormField
              control={form.control}
              name="branch"
              render={({ field: { value, onChange } }) => (
                <Input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Branch..."
                  className="w-52"
                  disabled={name == ""}
                />
              )}
            />

            <Button
              disabled={name == "" || form.formState.isSubmitting}
              variant="secondary"
              className="flex items-center gap-1"
              type="submit"
            >
              <TbRefresh />
              Sync
            </Button>
          </form>
        </Form>

        {configFiles.data?.map((configFile) => (
          <div key={configFile.id}>{configFile.name}</div>
        ))}
      </CardContent>
    </Card>
  );
};
