import type { GithubUser } from "@ctrlplane/db/schema";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { IconPlus } from "@tabler/icons-react";

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
import { EntityActionDropdown } from "./EntityActionDropdown";
import { GithubAddEntityDialog } from "./GithubAddEntityDialog";

type GithubConnectedEntitiesProps = {
  githubUser?: GithubUser | null;
  workspaceId: string;
  loading: boolean;
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
};

export const GithubConnectedEntities: React.FC<
  GithubConnectedEntitiesProps
> = async ({ githubUser, workspaceId, githubConfig }) => {
  const githubEntitiesUserCanAccess =
    githubUser != null
      ? await api.github.entities.byGithubUserId({
          workspaceId,
          githubUserId: githubUser.githubUserId,
        })
      : [];
  const githubEntitiesInstalled = await api.github.entities.list(workspaceId);

  const validEntitiesToAdd = githubEntitiesUserCanAccess.filter(
    (entity) =>
      !githubEntitiesInstalled.some(
        (installedEntity) => installedEntity.slug === entity.slug,
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
            You can configure job agents for these organizations
          </CardDescription>
        </div>
        {githubUser != null ? (
          <GithubAddEntityDialog
            githubUser={githubUser}
            githubConfig={githubConfig}
            workspaceId={workspaceId}
            validEntitiesToAdd={validEntitiesToAdd}
          >
            <Button size="icon" variant="secondary">
              <IconPlus className="h-3 w-3" />
            </Button>
          </GithubAddEntityDialog>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="cursor-not-allowed hover:bg-secondary hover:text-secondary-foreground"
                >
                  <IconPlus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Connect your Github account to add organizations</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>

      {githubEntitiesInstalled.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-4 p-4">
            {githubEntitiesInstalled.map((entity) => (
              <div
                key={entity.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={entity.avatarUrl ?? ""} />
                    <AvatarFallback>
                      <SiGithub className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="font-semibold text-neutral-200">
                      {entity.slug}
                    </p>
                    {entity.addedByUser != null && (
                      <p className="text-sm text-neutral-400">
                        Enabled by {entity.addedByUser.githubUsername} on{" "}
                        {entity.createdAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <EntityActionDropdown
                  githubConfig={githubConfig}
                  entity={entity}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
