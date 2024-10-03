import { Fragment } from "react";
import {
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

import { SystemActionsDropdown } from "~/app/[workspaceSlug]/systems/SystemActionsDropdown";
import { api } from "~/trpc/server";

export const SystemBreadcrumbNavbar = async ({
  params,
}: {
  params: {
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
    versionId?: string;
  };
}) => {
  const { workspaceSlug, systemSlug, deploymentSlug, versionId } = params;

  const system = systemSlug
    ? await api.system.bySlug({ workspaceSlug, systemSlug })
    : null;

  const deployment =
    deploymentSlug && systemSlug
      ? await api.deployment.bySlug({
          workspaceSlug,
          systemSlug,
          deploymentSlug,
        })
      : null;

  const release = versionId ? await api.release.byId(versionId) : null;

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
      path: `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`,
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
  ].filter((t) => t.isSet);

  return (
    <div className="flex items-center gap-2 p-3">
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
                        className="flex items-center gap-2 text-base "
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
      {/* <div>
        {system && (
          <SystemActionsDropdown system={system}>
            <Button variant="ghost" className="h-5 w-5">
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </SystemActionsDropdown>
        )}
      </div> */}
    </div>
  );
};
