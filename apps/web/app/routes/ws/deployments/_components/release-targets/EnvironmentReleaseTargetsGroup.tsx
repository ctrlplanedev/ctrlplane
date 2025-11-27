import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
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
import { VersionDisplay } from "./VersionDisplay";

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
type ReleaseTargetState = WorkspaceEngine["schemas"]["ReleaseTargetState"];
type Resource = WorkspaceEngine["schemas"]["Resource"];

type Environment = WorkspaceEngine["schemas"]["Environment"];
type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTarget[];
  environment: Environment;
};

type ReleaseTargetRowProps = {
  releaseTarget: {
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  };
  state: ReleaseTargetState;
  resource: Resource;
};

function ReleaseTargetRow({
  releaseTarget,
  state,
  resource,
}: ReleaseTargetRowProps) {
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
          message={state.latestJob?.message}
          status={
            (state.latestJob?.status ??
              "unknown") as keyof typeof JobStatusDisplayName
          }
        />
      </TableCell>
      <VersionDisplay {...state} />
      <TableCell className="text-right">
        <RedeployDialog releaseTarget={releaseTarget} />
      </TableCell>
    </TableRow>
  );
}

export function EnvironmentReleaseTargetsGroup({
  releaseTargets,
  environment,
}: EnvironmentReleaseTargetsGroupProps) {
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
      {rts.map(({ releaseTarget, state, resource }) => (
        <ReleaseTargetRow
          key={releaseTarget.resourceId}
          releaseTarget={releaseTarget}
          state={state}
          resource={resource}
        />
      ))}
    </Fragment>
  );
}
