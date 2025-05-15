"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { Layout, Layouts } from "react-grid-layout";
import { createContext, useContext, useState } from "react";

import { api } from "~/trpc/react";
import { useExpandedWidget } from "../_hooks/useExpandedWidget";

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

type DashboardContextType = {
  widgets: schema.DashboardWidget[];
  layout: Layouts;
  setLayout: (currentLayout: Layout[], allLayouts: Layouts) => void;
  addWidgetCreationPlaceholder: (widget: schema.DashboardWidget) => void;
  createWidget: (widget: schema.DashboardWidgetInsert) => Promise<void>;
  deleteWidget: (widgetId: string) => void;
};

export const NEW_WIDGET_ID = "new_widget";

const DashboardContext = createContext<DashboardContextType | null>(null);

export const DashboardContextProvider: React.FC<{
  dashboard: Dashboard;
  children: React.ReactNode;
}> = ({ dashboard, children }) => {
  const [widgets, setWidgets] = useState<schema.DashboardWidget[]>(
    dashboard.widgets,
  );

  const layout: Layouts = {
    lg: widgets.map((widget) => ({ i: widget.id, ...widget })),
  };

  const { setExpandedWidget, clearExpandedWidget } = useExpandedWidget();

  const addWidgetCreationPlaceholder = (widget: schema.DashboardWidget) => {
    setWidgets((prevWidgets) => {
      const prevWithoutPlaceholder = prevWidgets.filter(
        (widget) => widget.id !== NEW_WIDGET_ID,
      );
      const newWidgets = [...prevWithoutPlaceholder, widget];
      return newWidgets;
    });
    setExpandedWidget(widget.id, true);
  };

  const updateWidget = api.dashboard.widget.update.useMutation();

  const handleLayoutChange = (currentLayout: Layout[]) =>
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.map((widget) => {
        const layoutItem = currentLayout.find((item) => item.i === widget.id);
        if (layoutItem == null) return widget;

        return { ...widget, ...layoutItem };
      });

      for (const newWidget of newWidgets) {
        const prevWidget = prevWidgets.find((w) => w.id === newWidget.id);
        if (prevWidget == null) continue;

        const isXChanged = prevWidget.x !== newWidget.x;
        const isYChanged = prevWidget.y !== newWidget.y;
        const isWChanged = prevWidget.w !== newWidget.w;
        const isHChanged = prevWidget.h !== newWidget.h;

        const isResized = isXChanged || isYChanged || isWChanged || isHChanged;
        if (!isResized) continue;

        updateWidget.mutate({
          id: newWidget.id,
          data: {
            x: newWidget.x,
            y: newWidget.y,
            w: newWidget.w,
            h: newWidget.h,
          },
        });
      }

      return newWidgets;
    });

  const createWidgetMutation = api.dashboard.widget.create.useMutation();
  const utils = api.useUtils();
  const createWidget = async (widget: schema.DashboardWidgetInsert) => {
    const newWidget = await createWidgetMutation.mutateAsync(widget);
    utils.dashboard.get.invalidate();
    setWidgets((prevWidgets) => {
      const prevWithoutPlaceholder = prevWidgets.filter(
        (widget) => widget.id !== NEW_WIDGET_ID,
      );
      const newWidgets = [...prevWithoutPlaceholder, newWidget];
      return newWidgets;
    });
    clearExpandedWidget();
  };

  const deleteWidgetMutation = api.dashboard.widget.delete.useMutation();
  const deleteWidget = (widgetId: string) => {
    if (widgetId !== NEW_WIDGET_ID) deleteWidgetMutation.mutate(widgetId);
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.filter((widget) => widget.id !== widgetId);
      return newWidgets;
    });
    clearExpandedWidget();
    utils.dashboard.get.invalidate();
  };

  return (
    <DashboardContext.Provider
      value={{
        widgets,
        layout,
        setLayout: handleLayoutChange,
        addWidgetCreationPlaceholder,
        createWidget,
        deleteWidget,
      }}
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
