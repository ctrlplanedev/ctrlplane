"use client";

import type { GithubUser } from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";
import { IconBulb } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";

import { SelectPreconnectedEntityDialogContent } from "./SelectPreconnectedEntityDialogContent";

type GithubAddEntityDialogProps = {
  githubUser: GithubUser;
  children: React.ReactNode;
  githubConfig: { url: string; botName: string; clientId: string };
  validEntitiesToAdd: {
    installationId: number;
    type: "user" | "organization";
    slug: string;
    avatarUrl: string;
  }[];
  workspaceId: string;
};

export const GithubAddEntityDialog: React.FC<GithubAddEntityDialogProps> = ({
  githubUser,
  children,
  githubConfig,
  validEntitiesToAdd,
  workspaceId,
}) => {
  const [dialogStep, setDialogStep] = useState<"choose-org" | "pre-connected">(
    "choose-org",
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex flex-col gap-4">
        {dialogStep === "choose-org" && (
          <>
            <DialogHeader>
              <DialogTitle>Connect a new Organization</DialogTitle>
              {validEntitiesToAdd.length === 0 && (
                <DialogDescription>
                  Install the ctrlplane Github app on an organization to connect
                  it to your workspace.
                </DialogDescription>
              )}
            </DialogHeader>

            {validEntitiesToAdd.length > 0 && (
              <Alert variant="secondary">
                <IconBulb className="h-5 w-5" />
                <AlertTitle>Connect an organization</AlertTitle>
                <AlertDescription>
                  You have two options for connecting an organization:
                  <ol className="list-decimal space-y-2 pl-5">
                    <li>
                      <strong>Connect a new organization:</strong> Install the
                      ctrlplane Github app on a new organization.
                    </li>
                    <li>
                      <strong>Select pre-connected:</strong> Select a
                      pre-connected organization where the ctrlplane app is
                      installed.
                    </li>
                  </ol>
                  <span>
                    Read more{" "}
                    <Link
                      href="https://docs.ctrlplane.dev/integrations/github/github-bot"
                      target="_blank"
                      className="underline"
                    >
                      here
                    </Link>
                    .
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="flex">
              <Link
                href={`${githubConfig.url}/apps/${githubConfig.botName}/installations/select_target`}
              >
                <Button variant="outline">Connect new organization</Button>
              </Link>

              {validEntitiesToAdd.length > 0 && (
                <div className="flex flex-grow justify-end">
                  <Button
                    className="w-fit"
                    variant="outline"
                    onClick={() => setDialogStep("pre-connected")}
                  >
                    Select pre-connected
                  </Button>
                </div>
              )}
            </DialogFooter>
          </>
        )}

        {dialogStep === "pre-connected" && (
          <SelectPreconnectedEntityDialogContent
            githubEntities={validEntitiesToAdd}
            githubUser={githubUser}
            workspaceId={workspaceId}
            onNavigateBack={() => setDialogStep("choose-org")}
            onSave={() => {
              setOpen(false);
              setDialogStep("choose-org");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
