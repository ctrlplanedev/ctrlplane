import type { GithubUser } from "@ctrlplane/db/schema";
import { SiGithub } from "react-icons/si";
import { TbPlus } from "react-icons/tb";

import { Avatar, AvatarFallback, AvatarImage } from "@ctrlplane/ui/avatar";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { Separator } from "@ctrlplane/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/server";
import { GithubAddOrgDialog } from "./GithubAddOrgDialog";
import { OrgActionDropdown } from "./OrgActionDropdown";

type GithubConnectedOrgsProps = {
  githubUser?: GithubUser | null;
  workspaceId: string;
  loading: boolean;
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
};

export const GithubConnectedOrgs: React.FC<GithubConnectedOrgsProps> = async ({
  githubUser,
  workspaceId,
  githubConfig,
}) => {
  const githubOrgsUserCanAccess =
    githubUser != null
      ? await api.github.organizations.byGithubUserId({
          workspaceId,
          githubUserId: githubUser.githubUserId,
        })
      : [];
  const githubOrgsInstalled = await api.github.organizations.list(workspaceId);
  const validOrgsToAdd = githubOrgsUserCanAccess.filter(
    (org) =>
      !githubOrgsInstalled.some(
        (installedOrg) => installedOrg.organizationName === org.login,
      ),
  );

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
        {githubUser != null ? (
          <GithubAddOrgDialog
            githubUser={githubUser}
            githubConfig={githubConfig}
            workspaceId={workspaceId}
            validOrgsToAdd={validOrgsToAdd}
          >
            <Button size="icon" variant="secondary">
              <TbPlus className="h-3 w-3" />
            </Button>
          </GithubAddOrgDialog>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="cursor-not-allowed hover:bg-secondary hover:text-secondary-foreground"
                >
                  <TbPlus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Connect your Github account to add organizations</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>

      {githubOrgsInstalled.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-4 p-4">
            {githubOrgsInstalled.map((org) => (
              <div key={org.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={org.avatarUrl ?? ""} />
                    <AvatarFallback>
                      <SiGithub className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-semibold text-neutral-200">
                      {org.organizationName}
                    </p>
                    {org.addedByUser != null && (
                      <p className="text-sm text-neutral-400">
                        Enabled by {org.addedByUser.githubUsername} on{" "}
                        {org.createdAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <OrgActionDropdown githubConfig={githubConfig} org={org} />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
