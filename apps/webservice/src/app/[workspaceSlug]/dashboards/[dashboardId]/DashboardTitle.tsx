"use client";

import { useParams } from "next/navigation";
import { IconAlertSmall, IconDashboard, IconEdit } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@ctrlplane/ui/breadcrumb";

import { api } from "~/trpc/react";
import { useDashboardContext } from "../DashboardContext";

const EditButton: React.FC = () => {
  const { editMode, setEditMode } = useDashboardContext();
  return (
    <button
      onClick={() => setEditMode(!editMode)}
      className={cn(
        "shrink-0 rounded-full p-1 text-xs",
        editMode
          ? "bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/25"
          : "text-neutral-300 hover:bg-neutral-800 hover:text-white",
      )}
    >
      {editMode ? (
        <div className="flex items-center gap-1 pr-2">
          <IconAlertSmall />
          <span className="grow">Editing mode enabled</span>
        </div>
      ) : (
        <IconEdit />
      )}
    </button>
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
              <IconDashboard className="text-muted-foreground" />
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
