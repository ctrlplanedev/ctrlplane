import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMenu2, IconTopologyComplex } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { PageHeader } from "~/app/[workspaceSlug]/(app)/_components/PageHeader";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/server";
import { SystemTreePageContent } from "./SystemTreePageContent";

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}): Promise<Metadata> => {
  const { workspaceSlug } = await params;

  return api.workspace
    .bySlug(workspaceSlug)
    .then((workspace) => ({
      title: `Systems | ${workspace?.name ?? workspaceSlug} | Ctrlplane`,
      description: `Manage and deploy systems for the ${workspace?.name ?? workspaceSlug} workspace.`,
    }))
    .catch(() => ({
      title: "Systems | Ctrlplane",
      description: "Manage and deploy your systems with Ctrlplane.",
    }));
};

const SystemTreePageHeader: React.FC = () => {
  return (
    <PageHeader className="z-20 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <SidebarTrigger name={Sidebars.Deployments}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage className="flex items-center gap-1.5">
                <IconTopologyComplex className="h-4 w-4" />
                Systems Tree View
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </PageHeader>
  );
};

export default async function SystemsTreePage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();
  return (
    <div className="flex h-full flex-col">
      <SystemTreePageHeader />
      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto">
        <SystemTreePageContent workspace={workspace} />
      </div>
    </div>
  );
}
