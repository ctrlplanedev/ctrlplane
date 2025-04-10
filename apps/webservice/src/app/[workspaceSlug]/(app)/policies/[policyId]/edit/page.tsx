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

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";

export default async function CreatePolicyPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { workspaceSlug, policyId } = await params;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  const policy = await api.policy.byId(policyId);
  if (policy == null) return notFound();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center border-b px-6 py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>Update Policy</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
