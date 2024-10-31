import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconExternalLink, IconFilter, IconLoader2 } from "@tabler/icons-react";
import LZString from "lz-string";

import { Button } from "@ctrlplane/ui/button";
import { Label } from "@ctrlplane/ui/label";
import {
  defaultCondition,
  isEmptyCondition,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { ReleaseConditionBadge } from "../release-condition/ReleaseConditionBadge";
import { ReleaseConditionDialog } from "../release-condition/ReleaseConditionDialog";
import { ReleaseBadgeList } from "../ReleaseBadgeList";

type ReleaseFilterProps = {
  releaseChannel: SCHEMA.ReleaseChannel;
};

const getFinalFilter = (filter?: ReleaseCondition) =>
  filter && !isEmptyCondition(filter) ? filter : undefined;

const getReleaseFilterUrl = (
  workspaceSlug: string,

  systemSlug?: string,
  deploymentSlug?: string,
  filter?: ReleaseCondition,
) => {
  if (filter == null || systemSlug == null || deploymentSlug == null)
    return null;
  const baseUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`;
  const filterHash = LZString.compressToEncodedURIComponent(
    JSON.stringify(filter),
  );
  return `${baseUrl}/releases?filter=${filterHash}`;
};

export const ReleaseFilter: React.FC<ReleaseFilterProps> = ({
  releaseChannel,
}) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
  }>();

  const updateReleaseChannel =
    api.deployment.releaseChannel.update.useMutation();
  const router = useRouter();
  const utils = api.useUtils();
  const { releaseFilter, deploymentId } = releaseChannel;
  const filter = getFinalFilter(releaseFilter ?? undefined);

  const releasesQ = api.release.list.useQuery({
    deploymentId,
    filter,
    limit: 5,
  });
  const releases = releasesQ.data;

  const onUpdate = (filter?: ReleaseCondition) => {
    const releaseFilter = getFinalFilter(filter);
    updateReleaseChannel
      .mutateAsync({ id: releaseChannel.id, data: { releaseFilter } })
      .then(() =>
        utils.deployment.releaseChannel.byId.invalidate(releaseChannel.id),
      )
      .then(() => router.refresh());
  };

  const loading = releasesQ.isLoading;

  const releaseFilterUrl = getReleaseFilterUrl(
    workspaceSlug,
    systemSlug,
    deploymentSlug,
    filter,
  );

  if (loading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-2 p-6">
      <Label>Release Filter ({releases?.total ?? "-"})</Label>
      {filter != null && <ReleaseConditionBadge condition={filter} />}
      <div className="flex items-center gap-2">
        <ReleaseConditionDialog
          condition={filter ?? defaultCondition}
          deploymentId={deploymentId}
          onChange={onUpdate}
        >
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <IconFilter className="h-4 w-4" />
            Edit filter
          </Button>
        </ReleaseConditionDialog>
        {releaseFilterUrl != null && (
          <Link href={releaseFilterUrl} target="_blank">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <IconExternalLink className="h-4 w-4" />
              View releases
            </Button>
          </Link>
        )}
      </div>
      {releases != null && <ReleaseBadgeList releases={releases} />}
    </div>
  );
};
