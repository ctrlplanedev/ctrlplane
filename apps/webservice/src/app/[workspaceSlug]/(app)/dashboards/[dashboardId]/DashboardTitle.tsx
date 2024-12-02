"use client";

import { useParams } from "next/navigation";
import { IconLayout, IconX } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";
import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";
import { useDashboardContext } from "../DashboardContext";

const EditButton: React.FC = () => {
  const { editMode, setEditMode } = useDashboardContext();
  return (
    <Button
      size="sm"
      variant={editMode ? "outline" : "default"}
      onClick={() => setEditMode(!editMode)}
      aria-label={editMode ? "Disable editing mode" : "Enable editing mode"}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full p-1 px-2 pr-2 text-xs",
      )}
    >
      <IconX
        className={cn("h-4 w-4 transition-transform", !editMode && "rotate-45")}
      />
      <span className="grow">Add widgets</span>
    </Button>
  );
};

export const DashboardTitle: React.FC = () => {
  const { workspaceSlug, dashboardId } = useParams<{
    workspaceSlug: string;
    dashboardId: string;
  }>();
  const dashboard = api.dashboard.get.useQuery(dashboardId);
  return (
    <div className="flex shrink-0 items-center border-b p-4">
      <Breadcrumb className="flex-grow">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              href={`/${workspaceSlug}/systems`}
              className="flex items-center gap-2 text-white"
            >
              <IconLayout className="text-muted-foreground" />
              Dashboard
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              href={`/${workspaceSlug}/dashboards/${dashboardId}`}
              className="text-white"
            >
              {dashboard.data?.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <EditButton />
    </div>
  );
};
