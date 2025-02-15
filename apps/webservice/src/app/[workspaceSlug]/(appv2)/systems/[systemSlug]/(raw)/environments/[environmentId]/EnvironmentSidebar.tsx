"use client";

import { useContext } from "react";

import { cn } from "@ctrlplane/ui";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarProvider,
} from "@ctrlplane/ui/sidebar";

import { analyticsSidebarContext } from "./AnalyticsSidebarContext";
import { DailyResourceCountGraph } from "./resources/DailyResourceCountGraph";

type EnvironmentSidebarProps = { environmentId: string };

export const EnvironmentSidebar: React.FC<EnvironmentSidebarProps> = ({
  environmentId,
}) => {
  const { isOpen } = useContext(analyticsSidebarContext);

  return (
    <div
      className={cn(
        "border-1 relative w-1/2 transition-all duration-300 ease-in-out",
        !isOpen && "hidden",
      )}
    >
      <SidebarProvider>
        <Sidebar
          className="absolute right-0 top-0 w-full border-0"
          side="right"
        >
          <SidebarContent>
            <SidebarGroup>
              <div>
                Daily resource Count
                <DailyResourceCountGraph environmentId={environmentId} />
              </div>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
};
