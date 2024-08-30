import type { GithubUser } from "@ctrlplane/db/schema";
import { useState } from "react";
import { TbPlus } from "react-icons/tb";

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
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { env } from "~/env";
import { api } from "~/trpc/react";

export const GithubJobAgentConfig: React.FC<{
  githubUser: GithubUser;
  workspaceSlug: string;
  workspaceId: string;
}> = ({ githubUser, workspaceSlug, workspaceId }) => {
  const githubOrgs = api.github.organizations.byGithubUserId.useQuery(
    githubUser.githubUserId,
  );

  const githubOrgCreate = api.github.organizations.create.useMutation();

  const githubOrgsInstalled =
    api.github.organizations.list.useQuery(workspaceId);

  const { mutateAsync, isPending } = api.job.agent.create.useMutation();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          Connect an organization
        </CardTitle>
        <CardDescription>
          Select an organization to associate with this job agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="flex items-center gap-4">
          <div className="flex w-full items-center justify-between">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-[250px] items-center justify-start py-5"
                >
                  <div className="flex items-center gap-2">
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
                                org.login,
                            ),
                        )
                        .map(({ id, login, avatar_url }) => (
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
                          href={`${env.NEXT_PUBLIC_GITHUB_URL}/apps/${env.NEXT_PUBLIC_GITHUB_BOT_NAME}/installations/select_target?target_id=${githubUser.githubUserId}?redirect_uri=${env.NEXT_PUBLIC_BASE_URL}/${workspaceSlug}/job-agents/add`}
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
              className="w-fit"
              variant="secondary"
              disabled={isPending || value == null}
              onClick={async () => {
                const org = githubOrgs.data?.find((o) => o.login === value);

                if (org == null) return;

                await githubOrgCreate.mutateAsync({
                  installationId: org.installationId,
                  workspaceId,
                  organizationName: org.login,
                  addedByUserId: githubUser.userId,
                });

                await mutateAsync({
                  workspaceId,
                  type: "github-app",
                  name: org.login,
                  config: {
                    installationId: org.installationId,
                    login: org.login,
                  },
                });
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
