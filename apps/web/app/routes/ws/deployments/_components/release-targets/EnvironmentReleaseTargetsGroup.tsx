import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { FC } from "react";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { ChevronRight } from "lucide-react";

import { Button } from "~/components/ui/button";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { TableCell, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import {
  JobStatusBadge,
  JobStatusDisplayName,
} from "../../../_components/JobStatusBadge";
import { RedeployDialog } from "../RedeployDialog";

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetWithState"];

type Environment = WorkspaceEngine["schemas"]["Environment"];
type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTarget[];
  environment: Environment;
};

export const EnvironmentReleaseTargetsGroup: FC<
  EnvironmentReleaseTargetsGroupProps
> = ({ releaseTargets, environment }) => {
  const [open, setOpen] = useState(true);

  let cel: string | undefined = undefined;
  let jsonSelector: string | undefined = undefined;

  if (environment.resourceSelector) {
    if ("cel" in environment.resourceSelector) {
      cel = environment.resourceSelector.cel;
    }
    if ("json" in environment.resourceSelector) {
      jsonSelector = JSON.stringify(environment.resourceSelector.json, null, 2);
    }
  }

  const rts = open ? releaseTargets : [];

  return (
    <Fragment key={environment.id}>
      <TableRow key={environment.id}>
        <TableCell colSpan={4} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5 shrink-0"
            >
              <ChevronRight
                className={cn("s-4 transition-transform", open && "rotate-90")}
              />
            </Button>
            <div className="grow">{environment.name} </div>
            <span className="max-w-[60vw] shrink-0 truncate font-mono text-xs text-muted-foreground">
              {cel?.replaceAll("\n", " ").trim() ??
                jsonSelector?.trim().replaceAll("\n", " ")}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {rts.map(({ releaseTarget, state, resource }) => {
        const fromVersionRaw =
          state.currentRelease?.version.name ||
          state.currentRelease?.version.tag;
        const toVersion =
          (state.desiredRelease?.version.name ||
            state.desiredRelease?.version.tag) ??
          "unknown";
        const isInSync = !!fromVersionRaw && fromVersionRaw === toVersion;

        let versionDisplay;
        if (!fromVersionRaw) {
          versionDisplay = (
            <span className="italic text-neutral-500">
              Not yet deployed → {toVersion}
            </span>
          );
        } else if (isInSync) {
          versionDisplay = toVersion;
        } else {
          versionDisplay = `${fromVersionRaw} → ${toVersion}`;
        }

        return (
          <TableRow key={releaseTarget.resourceId}>
            <TableCell>
              <div className="flex items-center gap-2">
                <ResourceIcon
                  kind={resource?.kind ?? ""}
                  version={resource?.version ?? ""}
                />
                {resource?.name}
              </div>
            </TableCell>
            <TableCell>
              <JobStatusBadge
                status={
                  (state.latestJob?.status ??
                    "unknown") as keyof typeof JobStatusDisplayName
                }
              />
            </TableCell>
            <TableCell
              className={cn(
                isInSync ? "text-green-500" : "text-blue-500",
                "text-right font-mono text-sm",
              )}
            >
              {versionDisplay}
            </TableCell>
            <TableCell className="text-right">
              <RedeployDialog releaseTarget={releaseTarget} />
            </TableCell>
          </TableRow>
        );
      })}
    </Fragment>
  );
};
