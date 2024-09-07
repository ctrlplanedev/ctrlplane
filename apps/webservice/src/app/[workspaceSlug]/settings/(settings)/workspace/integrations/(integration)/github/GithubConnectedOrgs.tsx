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

import { api } from "~/trpc/server";
import { GithubAddOrgDialog } from "./GithubAddOrgDialog";
import { OrgActionDropdown } from "./OrgActionDropdown";

type GithubConnectedOrgsProps = {
  githubUser?: GithubUser | null;
  workspaceSlug?: string;
  workspaceId?: string;
  loading: boolean;
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
};

export const GithubConnectedOrgs: React.FC<GithubConnectedOrgsProps> = async ({
  githubUser,
  workspaceSlug,
  workspaceId,
  githubConfig,
}) => {
  const githubOrgsInstalled = await api.github.organizations.list(
    workspaceId ?? "",
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
        <GithubAddOrgDialog
          githubUser={githubUser ?? undefined}
          githubConfig={githubConfig}
          workspaceId={workspaceId ?? ""}
          workspaceSlug={workspaceSlug ?? ""}
        >
          <Button size="icon" variant="secondary" disabled={githubUser == null}>
            <TbPlus className="h-3 w-3" />
          </Button>
        </GithubAddOrgDialog>
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
