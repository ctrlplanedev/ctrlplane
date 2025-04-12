import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PolicyEditTabs } from "./_components/PolicyEditTabs";

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
    policyId: string;
  }>;
}) {
  const { params, children } = props;
  const { workspaceSlug, policyId } = await params;

  const policy = await api.policy.byId({ policyId });
  if (policy == null) return notFound();
  const policiesPage = urls.workspace(workspaceSlug).policies().baseUrl();

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader>
        <div className="flex shrink-0 items-center gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={policiesPage}>
                    <IconArrowLeft className="size-5" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbPage>Edit policy {policy.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </PageHeader>

      <div className="flex flex-grow overflow-hidden">
        <PolicyEditTabs />
        <div className="w-full flex-grow">
          <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 h-full overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
