"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { Layout, Layouts } from "react-grid-layout";
import { createContext, useContext, useState } from "react";

import { api } from "~/trpc/react";

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

type DashboardContextType = {
  dashboard: Dashboard;
  layout: Layouts;
  setLayout: (currentLayout: Layout[], allLayouts: Layouts) => void;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashboardContextProvider: React.FC<{
  dashboard: Dashboard;
  children: React.ReactNode;
}> = ({ dashboard, children }) => {
  const [layout, setLayout] = useState<Layouts>({
    lg: dashboard.widgets.map((widget) => ({
      i: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
    })),
  });

  const updateWidget = api.dashboard.widget.update.useMutation();

  const handleLayoutChange = (currentLayout: Layout[], allLayouts: Layouts) =>
    setLayout((prevLayout) => {
      for (const layoutItem of currentLayout) {
        const prevLayoutItem = prevLayout.lg?.find(
          (item) => item.i === layoutItem.i,
        );
        if (prevLayoutItem == null) continue;

        const isXChanged = prevLayoutItem.x !== layoutItem.x;
        const isYChanged = prevLayoutItem.y !== layoutItem.y;
        const isWChanged = prevLayoutItem.w !== layoutItem.w;
        const isHChanged = prevLayoutItem.h !== layoutItem.h;

        const isResized = isXChanged || isYChanged || isWChanged || isHChanged;

        if (!isResized) continue;

        updateWidget.mutate({
          id: layoutItem.i,
          data: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          },
        });
      }
      return allLayouts;
    });

  return (
    <DashboardContext.Provider
      value={{ dashboard, layout, setLayout: handleLayoutChange }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context == null) {
    throw new Error(
      "useDashboard must be used within a DashboardContextProvider",
    );
  }
  return context;
};
