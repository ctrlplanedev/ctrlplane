import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@ctrlplane/ui/breadcrumb";

import { api } from "~/trpc/server";
import { DeploymentsCard } from "../_components/deployments/Card";
import { PageHeader } from "../_components/PageHeader";

export const metadata: Metadata = {
  title: "Deployments | Ctrlplane",
};

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function DeploymentsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) notFound();

  return (
    <div>
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">Deployments</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="container m-8 mx-auto">
        <DeploymentsCard workspaceId={workspace.id} />
      </div>
    </div>
  );
}
