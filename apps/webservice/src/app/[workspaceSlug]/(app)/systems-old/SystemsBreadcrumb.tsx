import { Fragment } from "react";
import {
  IconBook,
  IconCategory,
  IconDotsVertical,
  IconServer,
  IconShip,
  IconTag,
} from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";

import { SystemActionsDropdown } from "~/app/[workspaceSlug]/(app)/systems-old/SystemActionsDropdown";
import { api } from "~/trpc/server";

export const SystemBreadcrumbNavbar = async ({
  params,
}: {
  params: {
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
    versionId?: string;
    runbookId?: string;
  };
}) => {
  const { workspaceSlug, systemSlug, deploymentSlug, versionId, runbookId } =
    params;

  const system = systemSlug
    ? await api.system.bySlug({ workspaceSlug, systemSlug })
    : null;

  const runbook = runbookId ? await api.runbook.byId(runbookId) : null;

  const deployment =
    deploymentSlug && systemSlug
      ? await api.deployment.bySlug({
          workspaceSlug,
          systemSlug,
          deploymentSlug,
        })
      : null;

  const release = versionId ? await api.deployment.version.byId(versionId) : null;

  const crumbs = [
    {
      isSet: true,
      name: (
        <>
          <IconCategory className="h-4 w-4" /> Systems
        </>
      ),
      path: `/${workspaceSlug}/systems`,
    },
    {
      isSet: system?.name != null,
      name: (
        <>
          <IconServer className="h-4 w-4" /> {system?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}`,
    },
    {
      isSet: deployment?.name != null,
      name: (
        <>
          <IconShip className="h-4 w-4" /> {deployment?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/releases`,
    },
    {
      isSet: release?.version != null,
      name: (
        <>
          <IconTag className="h-4 w-4" /> {release?.version}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}/releases/${versionId}`,
    },
    {
      isSet: runbook != null,
      name: (
        <>
          <IconBook className="h-4 w-4" /> {runbook?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}/runbooks/${runbookId}`,
    },
  ].filter((t) => t.isSet);

  return (
    <div className="flex w-full items-center gap-2 p-3">
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;

            return (
              <Fragment key={idx}>
                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-2 text-base">
                    {crumb.name}
                  </BreadcrumbPage>
                ) : (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        href={crumb.path}
                        className="flex items-center gap-2 text-base"
                      >
                        {crumb.name}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex">
        {system && crumbs.length === 2 && (
          <SystemActionsDropdown system={system}>
            <Button
              variant="ghost"
              size="icon"
              className="flex h-6 w-6 items-center"
            >
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </SystemActionsDropdown>
        )}
      </div>
    </div>
  );
};
