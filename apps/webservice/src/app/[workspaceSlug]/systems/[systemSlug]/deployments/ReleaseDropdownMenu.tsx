"use client";

import { useRouter } from "next/navigation";
import { TbDotsVertical, TbReload } from "react-icons/tb";

import { Badge } from "@ctrlplane/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";

export const ReleaseDropdownMenu: React.FC<{
  release: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
  };
  isReleaseCompleted: boolean;
}> = ({ release, environment, isReleaseCompleted }) => {
  const router = useRouter();
  const redeploy = api.release.deploy.toEnvironment.useMutation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <TbDotsVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Dialog>
          <DialogTrigger asChild>
            <DropdownMenuItem
              disabled={!isReleaseCompleted}
              onSelect={(e) => e.preventDefault()}
              className="space-x-2"
            >
              <TbReload />
              <span>Redeploy</span>
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Redeploy{" "}
                <Badge variant="secondary" className="h-7 text-lg">
                  {release.name}
                </Badge>{" "}
                to {environment.name}?
              </DialogTitle>
              <DialogDescription>
                This will redeploy the release to all targets in the
                environment.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                onClick={() =>
                  redeploy
                    .mutateAsync({
                      environmentId: environment.id,
                      releaseId: release.id,
                    })
                    .then(() => router.refresh())
                }
              >
                Redeploy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
