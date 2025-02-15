"use client";

import { useContext } from "react";
import Link from "next/link";
import { IconArrowLeft, IconGraph } from "@tabler/icons-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";
import { Separator } from "@ctrlplane/ui/separator";

import { PageHeader } from "~/app/[workspaceSlug]/(appv2)/_components/PageHeader";
import { analyticsSidebarContext } from "./AnalyticsSidebarContext";

type EnvironmentHeaderProps = {
  workspaceSlug: string;
  systemSlug: string;
  environmentName: string;
};

export const EnvironmentHeader: React.FC<EnvironmentHeaderProps> = ({
  workspaceSlug,
  systemSlug,
  environmentName,
}) => {
  const { isOpen, setIsOpen } = useContext(analyticsSidebarContext);

  return (
    <PageHeader className="justify-between">
      <div className="flex shrink-0 items-center gap-4">
        <Link href={`/${workspaceSlug}/systems/${systemSlug}/deployments`}>
          <IconArrowLeft className="size-5" />
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                href={`/${workspaceSlug}/systems/${systemSlug}/environments`}
              >
                Environments
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{environmentName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <Button onClick={() => setIsOpen(!isOpen)} variant="ghost" size="icon">
        <IconGraph />
      </Button>
    </PageHeader>
  );
};
