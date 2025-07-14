"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { Layout, Layouts } from "react-grid-layout";
import { createContext, useContext, useState } from "react";

import { api } from "~/trpc/react";

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

export const MOVE_BUTTON_CLASS_NAME = "widget-drag-handle";

type DashboardContextType = {
  widgets: schema.DashboardWidget[];
  layout: Layouts;
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
  setLayout: (
    currentLayout: Layout[],
    placeholderWidget?: schema.DashboardWidget,
  ) => void;
  createWidget: (widget: schema.DashboardWidgetInsert) => Promise<void>;
  isCreatingWidget: boolean;
  updateWidget: (
    widgetId: string,
    widget: schema.DashboardWidgetUpdate,
  ) => Promise<void>;
  isUpdatingWidget: boolean;
  deleteWidget: (widgetId: string) => void;
  isDeletingWidget: boolean;
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

  const [isEditMode, setIsEditMode] = useState(false);
  const onEditModeChange = (isEditMode: boolean) => {
    setIsEditMode(isEditMode);
    if (isEditMode) return;
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.filter(
        (widget) => widget.id !== NEW_WIDGET_ID,
      );
      return newWidgets;
    });
  };

  const layout: Layouts = {
    lg: widgets.map((widget) => ({ i: widget.id, ...widget })),
  };

  const updateWidgetMutation = api.dashboard.widget.update.useMutation();
  const handleLayoutChange = (
    currentLayout: Layout[],
    placeholderWidget?: schema.DashboardWidget,
  ) =>
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

        updateWidgetMutation.mutate({
          id: newWidget.id,
          data: {
            x: newWidget.x,
            y: newWidget.y,
            w: newWidget.w,
            h: newWidget.h,
          },
        });
      }

      if (placeholderWidget == null) return newWidgets;
      return [...newWidgets, placeholderWidget];
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
  };

  const updateWidget = async (
    widgetId: string,
    widget: schema.DashboardWidgetUpdate,
  ) => {
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.map((w) => {
        if (w.id === widgetId) return { ...w, ...widget };
        return w;
      });
      return newWidgets;
    });
    await updateWidgetMutation.mutateAsync({ id: widgetId, data: widget });
  };

  const deleteWidgetMutation = api.dashboard.widget.delete.useMutation();
  const deleteWidget = (widgetId: string) => {
    if (widgetId !== NEW_WIDGET_ID) deleteWidgetMutation.mutate(widgetId);
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.filter((widget) => widget.id !== widgetId);
      return newWidgets;
    });
    utils.dashboard.get.invalidate();
  };

  return (
    <DashboardContext.Provider
      value={{
        widgets,
        layout,
        isEditMode,
        setIsEditMode: onEditModeChange,
        setLayout: handleLayoutChange,
        createWidget,
        isCreatingWidget: createWidgetMutation.isPending,
        updateWidget,
        isUpdatingWidget: updateWidgetMutation.isPending,
        deleteWidget,
        isDeletingWidget: deleteWidgetMutation.isPending,
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
