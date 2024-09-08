"use client";

import type { GithubUser } from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";

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

import type { GithubOrg } from "./SelectPreconnectedOrgDialogContent";
import { Callout } from "../../../../../../_components/Callout";
import { SelectPreconnectedOrgDialogContent } from "./SelectPreconnectedOrgDialogContent";

type GithubAddOrgDialogProps = {
  githubUser: GithubUser;
  children: React.ReactNode;
  githubConfig: {
    url: string;
    botName: string;
    clientId: string;
  };
  validOrgsToAdd: GithubOrg[];
  workspaceId: string;
};

export const GithubAddOrgDialog: React.FC<GithubAddOrgDialogProps> = ({
  githubUser,
  children,
  githubConfig,
  validOrgsToAdd,
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
              {validOrgsToAdd.length === 0 && (
                <DialogDescription>
                  Install the ctrlplane Github app on an organization to connect
                  it to your workspace.
                </DialogDescription>
              )}
            </DialogHeader>

            {validOrgsToAdd.length > 0 && (
              <Callout>
                You have two options for connecting an organization:
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <strong>Connect a new organization:</strong> Install the
                    ctrlplane Github app on an organization to connect it to
                    your workspace.
                  </li>
                  <li>
                    <strong>Select a pre-connected organization:</strong> Choose
                    an organization that already has the ctrlplane Github app
                    installed.
                  </li>
                </ol>
                <span>
                  Read more{" "}
                  <Link
                    href="https://docs.ctrlplane.dev/integrations/github/github-bot"
                    className="underline"
                    target="_blank"
                  >
                    here
                  </Link>
                  .
                </span>
              </Callout>
            )}

            <DialogFooter className="flex">
              <Link
                href={`${githubConfig.url}/apps/${githubConfig.botName}/installations/select_target`}
              >
                <Button variant="outline">Connect new organization</Button>
              </Link>

              {validOrgsToAdd.length > 0 && (
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
          <SelectPreconnectedOrgDialogContent
            githubOrgs={validOrgsToAdd}
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
