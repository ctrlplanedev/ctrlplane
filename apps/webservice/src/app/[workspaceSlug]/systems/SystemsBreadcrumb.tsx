"use client";

import { Fragment } from "react";
import { useParams } from "next/navigation";
import { TbCategory, TbServer, TbShip, TbTag } from "react-icons/tb";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";

import { api } from "~/trpc/react";

export const SystemBreadcrumbNavbar: React.FC = () => {
  const { workspaceSlug, systemSlug, deploymentSlug, versionId } = useParams<{
    workspaceSlug: string;
    systemSlug?: string;
    deploymentSlug?: string;
    versionId?: string;
  }>();

  const system = api.system.bySlug.useQuery(
    { workspaceSlug, systemSlug: systemSlug ?? "" },
    { enabled: systemSlug != null },
  );

  const deployment = api.deployment.bySlug.useQuery(
    {
      workspaceSlug,
      systemSlug: systemSlug ?? "",
      deploymentSlug: deploymentSlug ?? "",
    },
    { enabled: deploymentSlug != null },
  );

  // const target = api.target.byId.useQuery(targetId ?? "", {
  //   enabled: targetId != null,
  // });

  const release = api.release.byId.useQuery(versionId ?? "", {
    enabled: versionId != null,
  });

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
      isSet: system.data?.name != null,
      name: (
        <>
          <TbServer /> {system.data?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}`,
    },
    {
      isSet: deployment.data?.name != null,
      name: (
        <>
          <TbShip /> {deployment.data?.name}
        </>
      ),
      path: `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`,
    },
    {
      isSet: release.data?.version != null,
      name: (
        <>
          <TbTag /> {release.data?.version}
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
