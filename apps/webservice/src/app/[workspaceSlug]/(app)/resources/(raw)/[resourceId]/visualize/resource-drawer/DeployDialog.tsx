import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import { IconPin, IconPinFilled, IconPinnedOff } from "@tabler/icons-react";
import { useDebounce } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { Deployment } from "./types";
import { CollapsibleSearchInput } from "~/app/[workspaceSlug]/(app)/_components/CollapsibleSearchInput";
import { api } from "~/trpc/react";
import { ReleaseTargetSummary } from "./ReleaseTargetSummary";

const VersionPinningDialog: React.FC<{
  releaseTarget: schema.ReleaseTarget;
  resource: schema.Resource;
  deployment: schema.Deployment;
  version: schema.DeploymentVersion;
  children: React.ReactNode;
}> = ({ releaseTarget, resource, version, children }) => {
  const pinVersion = api.releaseTarget.pinVersion.useMutation();
  const utils = api.useUtils();
  const invalidate = () => {
    utils.resource.allSystemsOverview.invalidate(resource.id);
    utils.dashboard.widget.data.releaseTargetModule.deployableVersions.invalidate(
      { releaseTargetId: releaseTarget.id },
    );
  };

  const releaseTargetId = releaseTarget.id;
  const versionId = version.id;
  const onPin = () =>
    pinVersion.mutateAsync({ releaseTargetId, versionId }).then(invalidate);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin version</DialogTitle>
          <DialogDescription>
            This will pin {resource.name} to version{" "}
            <span className="font-mono">{version.tag}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onPin} disabled={pinVersion.isPending}>
            Pin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const VersionUnpinningDialog: React.FC<{
  releaseTarget: schema.ReleaseTarget;
  resource: schema.Resource;
  deployment: schema.Deployment;
  version: schema.DeploymentVersion;
  children: React.ReactNode;
}> = ({ releaseTarget, resource, deployment, version, children }) => {
  const unpinVersion = api.releaseTarget.unpinVersion.useMutation();
  const utils = api.useUtils();
  const invalidate = () =>
    utils.resource.allSystemsOverview.invalidate(resource.id);

  const onUnpin = () =>
    unpinVersion.mutateAsync(releaseTarget.id).then(invalidate);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Unpin {resource.name} from {deployment.name}
            version <span className="font-mono">{version.tag}</span>?
          </DialogTitle>
          <DialogDescription>
            This will unpin the resource from this version. The resource will
            redeploy with the latest valid version.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-between sm:justify-between">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onUnpin} disabled={unpinVersion.isPending}>
            Unpin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const VersionsTable: React.FC<{
  releaseTarget: schema.ReleaseTarget;
  resource: schema.Resource;
  deployment: schema.Deployment;
}> = ({ releaseTarget, resource, deployment }) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useDebounce(() => setDebouncedQuery(query), 500, [query]);

  const { data, isLoading } =
    api.dashboard.widget.data.releaseTargetModule.deployableVersions.useQuery(
      { releaseTargetId: releaseTarget.id, query: debouncedQuery },
      { placeholderData: (prev) => prev },
    );

  const versions = data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <CollapsibleSearchInput value={query} onChange={setQuery} />
      {isLoading && (
        <div className="space-y-2 p-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-6 w-full"
              style={{ opacity: 1 * (1 - index / 10) }}
            />
          ))}
        </div>
      )}
      {!isLoading && (
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id} className="hover:bg-transparent">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {version.tag}
                      {releaseTarget.desiredVersionId === version.id && (
                        <IconPinFilled className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{version.name}</TableCell>
                  <TableCell>{version.createdAt.toLocaleString()}</TableCell>
                  <TableCell>
                    {releaseTarget.desiredVersionId !== version.id && (
                      <VersionPinningDialog
                        releaseTarget={releaseTarget}
                        resource={resource}
                        deployment={deployment}
                        version={version}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex h-7 items-center gap-1"
                        >
                          <IconPin className="h-4 w-4" />
                          Pin
                        </Button>
                      </VersionPinningDialog>
                    )}
                    {releaseTarget.desiredVersionId === version.id && (
                      <VersionUnpinningDialog
                        releaseTarget={releaseTarget}
                        resource={resource}
                        deployment={deployment}
                        version={version}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex h-7 items-center gap-1"
                        >
                          <IconPinnedOff className="h-4 w-4" />
                          Unpin
                        </Button>
                      </VersionUnpinningDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export const DeployDialog: React.FC<{
  resource: schema.Resource;
  deployment: Deployment;
  environment: schema.Environment;
  releaseTarget: schema.ReleaseTarget;
  children: React.ReactNode;
}> = ({ resource, deployment, environment, releaseTarget, children }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl">
        <div className="flex w-full flex-col gap-4">
          <div className="text-lg font-medium">
            Deploy {deployment.name} to {resource.name}
          </div>
          <div className="flex w-full items-center justify-between">
            <ReleaseTargetSummary
              resource={resource}
              environment={environment}
              deployment={deployment}
            />
          </div>
          <VersionsTable
            releaseTarget={releaseTarget}
            resource={resource}
            deployment={deployment}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
