"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IconMenu2 } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Separator } from "@ctrlplane/ui/separator";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { PageHeader } from "../../_components/PageHeader";

interface PageWithBreadcrumbsProps {
  children: React.ReactNode;
  pageName: string;
  title?: React.ReactNode;
}

export function PageWithBreadcrumbs({
  children,
  pageName,
  title,
}: PageWithBreadcrumbsProps) {
  const params = useParams<{ workspaceSlug: string }>();

  return (
    <div className="flex h-full flex-col">
      <PageHeader className="z-10">
        <SidebarTrigger name={Sidebars.Rules}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${params.workspaceSlug}/rules`}>Rules</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex-1 overflow-y-auto p-6">
        {title && <div className="mb-6">{title}</div>}
        {children}
      </div>
    </div>
  );
}
