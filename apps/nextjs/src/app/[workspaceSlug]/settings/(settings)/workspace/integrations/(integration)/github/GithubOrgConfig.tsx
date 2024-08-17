import type { GithubUser } from "@ctrlplane/db/schema";
import { useState } from "react";
import _ from "lodash";
import { SiGithub } from "react-icons/si";
import { TbChevronDown, TbPlus } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { Separator } from "@ctrlplane/ui/separator";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { env } from "~/env";
import { api } from "~/trpc/react";

export const GithubOrgConfig: React.FC<{
  githubUser?: GithubUser | null;
  workspaceSlug?: string;
  workspaceId?: string;
  loading: boolean;
}> = ({ githubUser, workspaceSlug, workspaceId, loading }) => {
  const githubOrgs = api.github.organizations.byGithubUserId.useQuery(
    githubUser?.githubUserId ?? 0,
    { enabled: !loading && githubUser != null },
  );
  const githubOrgCreate = api.github.organizations.create.useMutation();
  const githubOrgsInstalled = api.github.organizations.list.useQuery(
    workspaceId ?? "",
    { enabled: !loading && workspaceId != null },
  );
  const githubOrgUpdate = api.github.organizations.update.useMutation();
  const jobAgentCreate = api.job.agent.create.useMutation();

  const utils = api.useUtils();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);

  return (
    <Card className="rounded-md">
      <CardContent className="flex justify-between p-0 pr-4">
        <CardHeader>
          <CardTitle
            className={cn(
              "flex items-center gap-1",
              (loading || githubUser == null) && "opacity-50",
            )}
          >
            Connect an organization
          </CardTitle>
          <CardDescription>
            Select an organization to integrate with Ctrlplane.
          </CardDescription>
        </CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex w-full items-center justify-between gap-4">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[250px] items-center justify-start py-5"
                  disabled={loading || githubUser == null}
                >
                  <div className="flex h-10 items-center gap-2">
                    {image !== null && (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={image} />
                        <AvatarFallback>{value?.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    )}

                    <span className="max-w-[200px] overflow-hidden text-ellipsis">
                      {value ?? "Select organization..."}
                    </span>
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Search organization..." />
                  <CommandGroup>
                    <CommandList>
                      {githubOrgs.data
                        ?.filter(
                          (org) =>
                            !githubOrgsInstalled.data?.some(
                              (o) =>
                                o.github_organization.organizationName ===
                                  org.data.login &&
                                o.github_organization.connected === true,
                            ),
                        )
                        .map(({ data: { id, login, avatar_url } }) => (
                          <CommandItem
                            key={id}
                            value={login}
                            onSelect={(currentValue) => {
                              setValue(currentValue);
                              setImage(avatar_url);
                              setOpen(false);
                            }}
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

                      <CommandItem>
                        <a
                          href={`${env.GITHUB_URL}/apps/${env.GITHUB_BOT_NAME}/installations/select_target?target_id=${githubUser?.githubUserId}?redirect_uri=${env.BASE_URL}/${workspaceSlug}/job-agents/add`}
                          className="flex items-center gap-2"
                        >
                          <TbPlus />
                          Add new organization
                        </a>
                      </CommandItem>
                    </CommandList>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            <Button
              variant="secondary"
              className="h-10 w-fit"
              disabled={jobAgentCreate.isPending || value == null}
              onClick={async () => {
                const existingOrg = githubOrgsInstalled.data?.find(
                  (o) => o.github_organization.organizationName === value,
                );

                if (existingOrg != null)
                  await githubOrgUpdate.mutateAsync({
                    id: existingOrg.github_organization.id,
                    data: {
                      connected: true,
                    },
                  });

                const org = githubOrgs.data?.find(
                  ({ data }) => data.login === value,
                );

                if (org == null) return;

                await githubOrgCreate.mutateAsync({
                  installationId: org.installationId,
                  workspaceId: workspaceId ?? "",
                  organizationName: org.data.login,
                  addedByUserId: githubUser?.userId ?? "",
                  avatarUrl: org.data.avatar_url,
                });

                await jobAgentCreate.mutateAsync({
                  workspaceId: workspaceId ?? "",
                  type: "github-app",
                  name: org.data.login,
                  config: {
                    installationId: org.installationId,
                    login: org.data.login,
                  },
                });

                await utils.github.organizations.list.invalidate();
                setValue;
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>

      <Separator />
      {(loading || githubOrgsInstalled.isLoading) && (
        <div className="flex flex-col gap-4 p-4">
          {_.range(3).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 3) }}
            />
          ))}
        </div>
      )}
      {!loading && !githubOrgsInstalled.isLoading && (
        <CardContent className="flex flex-col gap-8 p-4">
          {githubOrgsInstalled.data?.map(
            ({ github_organization, github_user }) => (
              <div
                key={github_organization.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={github_organization.avatarUrl ?? ""} />
                    <AvatarFallback>
                      <SiGithub className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-semibold text-neutral-200">
                      {github_organization.organizationName}
                    </p>
                    {github_user != null && (
                      <p className="text-sm text-neutral-400">
                        Enabled by {github_user?.githubUsername} on{" "}
                        {github_organization.createdAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Connected
                      <TbChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <a
                        href={`${env.GITHUB_URL}/organizations/${github_organization.organizationName}/settings/installations/${github_organization.installationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(
                            e.currentTarget.href,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        Configure
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        await githubOrgUpdate.mutateAsync({
                          id: github_organization.id,
                          data: {
                            connected: false,
                          },
                        });
                      }}
                    >
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          )}
        </CardContent>
      )}
    </Card>
  );
};
