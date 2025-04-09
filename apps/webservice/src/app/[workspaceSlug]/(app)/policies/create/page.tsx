import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PolicyContextProvider } from "./_components/PolicyContext";
import { PolicyCreationTabs } from "./_components/PolicyCreationTabs";

export default async function CreatePolicyPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const workspaceSlug = (await params).workspaceSlug;
  const workspace = await api.workspace.bySlug(workspaceSlug);
  if (workspace == null) return notFound();

  // Fetch environments and deployments for selection
  // const environments = await api.environment.byWorkspaceId(workspace.id);
  // const deployments = await api.deployment.byWorkspaceId(workspace.id);

  return (
    <PolicyContextProvider>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-center border-b px-6 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href={urls.workspace(workspaceSlug).policies().baseUrl()}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem>
                <BreadcrumbPage>Create NewPolicy</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-grow overflow-hidden">
          <PolicyCreationTabs />
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="ml-64 flex items-center gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Create Policy</Button>
          </div>
        </div>
      </div>
    </PolicyContextProvider>
  );
}
