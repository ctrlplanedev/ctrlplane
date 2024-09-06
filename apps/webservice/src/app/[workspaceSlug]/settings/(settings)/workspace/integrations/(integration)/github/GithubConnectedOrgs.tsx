import type { GithubUser } from "@ctrlplane/db/schema";
import Link from "next/link";
import _ from "lodash";
import { SiGithub } from "react-icons/si";
import { TbChevronDown, TbPlus } from "react-icons/tb";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Separator } from "@ctrlplane/ui/separator";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { GithubAddOrgDialog } from "./GithubAddOrgDialog";

interface GithubConnectedOrgsProps {
  githubUser?: GithubUser | null;
  workspaceSlug?: string;
  workspaceId?: string;
  loading: boolean;
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
}

export const GithubConnectedOrgs: React.FC<GithubConnectedOrgsProps> = ({
  githubUser,
  workspaceSlug,
  workspaceId,
  githubConfig,
}) => {
  const githubOrgsInstalled = api.github.organizations.list.useQuery(
    workspaceId ?? "",
    { enabled: workspaceId != null },
  );
  const githubOrgUpdate = api.github.organizations.update.useMutation();

  return (
    <Card className="rounded-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="flex-grow">
            Connected Github organizations
          </CardTitle>
          <CardDescription>
            You can configure job agents and sync config files for these
            organizations
          </CardDescription>
        </div>
        <GithubAddOrgDialog
          githubUserId={githubUser?.githubUserId ?? 0}
          githubConfig={githubConfig}
          workspaceId={workspaceId ?? ""}
          workspaceSlug={workspaceSlug ?? ""}
        >
          <Button size="icon" variant="secondary" disabled={githubUser == null}>
            <TbPlus className="h-3 w-3" />
          </Button>
        </GithubAddOrgDialog>
      </CardHeader>

      {githubOrgsInstalled.isLoading && (
        <div className="flex flex-col gap-4">
          {_.range(3).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 3) }}
            />
          ))}
        </div>
      )}
      {githubOrgsInstalled.data != null &&
        githubOrgsInstalled.data.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-4 p-4">
              {githubOrgsInstalled.data.map(
                ({ github_organization, github_user }) => (
                  <div
                    key={github_organization.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={github_organization.avatarUrl ?? ""}
                        />
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
                            Enabled by {github_user.githubUsername} on{" "}
                            {github_organization.createdAt.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="flex items-center gap-2"
                        >
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Connected
                          <TbChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <Link
                            href={`${githubConfig.url}/organizations/${github_organization.organizationName}/settings/installations/${github_organization.installationId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Configure
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            githubOrgUpdate.mutateAsync({
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
            </div>
          </>
        )}
    </Card>
  );
};
