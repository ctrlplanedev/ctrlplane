import { Fragment } from "react";
import { TbCategory, TbServer, TbShip, TbTag } from "react-icons/tb";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";

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
          <TbCategory /> Systems
        </>
      ),
      path: `/${workspaceSlug}/systems`,
    },
    {
      isSet: system?.name != null,
      name: (
        <>
          <TbServer /> {system?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}`,
    },
    {
      isSet: deployment?.name != null,
      name: (
        <>
          <TbShip /> {deployment?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`,
    },
    {
      isSet: release?.version != null,
      name: (
        <>
          <TbTag /> {release?.version}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}/releases/${versionId}`,
    },
  ].filter((t) => t.isSet);

  return (
    <Breadcrumb className="p-3">
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
  );
};
