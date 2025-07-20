"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { Dispatch, SetStateAction } from "react";
import type { Layout, Layouts } from "react-grid-layout";
import { createContext, useContext, useState } from "react";
import { useParams } from "next/navigation";

import { api } from "~/trpc/react";
import { useEditingWidget } from "./_hooks/useEditingWidget";

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

export const MOVE_BUTTON_CLASS_NAME = "widget-drag-handle";

type DashboardContextType = {
  widgets: schema.DashboardWidget[];
  layout: Layouts;
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
  setLayout: (currentLayout: Layout[]) => void;
  createWidget: (widget: schema.DashboardWidgetInsert) => Promise<void>;
  updateWidget: (
    widgetId: string,
    widget: schema.DashboardWidgetUpdate,
  ) => Promise<void>;
  deleteWidget: (widgetId: string) => void;
  isUpdating: boolean;
};

export const NEW_WIDGET_ID = "new_widget";

const DashboardContext = createContext<DashboardContextType | null>(null);

const useEditMode = (
  setWidgets: Dispatch<SetStateAction<schema.DashboardWidget[]>>,
) => {
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

  return { isEditMode, setIsEditMode: onEditModeChange };
};

const useHandleLayoutChange = (
  setWidgets: Dispatch<SetStateAction<schema.DashboardWidget[]>>,
) => {
  const updateWidgetMutation = api.dashboard.widget.update.useMutation();
  return (currentLayout: Layout[]) =>
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
      return newWidgets;
    });
};

const useCreateWidget = (
  setWidgets: Dispatch<SetStateAction<schema.DashboardWidget[]>>,
) => {
  const { setEditingWidget } = useEditingWidget();
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const createWidgetMutation = api.dashboard.widget.create.useMutation();
  const utils = api.useUtils();
  const createWidget = async (widget: schema.DashboardWidgetInsert) => {
    const newWidget = await createWidgetMutation.mutateAsync(widget);
    setEditingWidget(newWidget.id);
    utils.dashboard.get.invalidate(dashboardId);
    setWidgets((prevWidgets) => {
      const newWidgets = [...prevWidgets, newWidget];
      return newWidgets;
    });
  };
  return { createWidget, isCreatingWidget: createWidgetMutation.isPending };
};

const useUpdateWidget = (
  setWidgets: Dispatch<SetStateAction<schema.DashboardWidget[]>>,
) => {
  const updateWidgetMutation = api.dashboard.widget.update.useMutation();
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
  return { updateWidget, isUpdatingWidget: updateWidgetMutation.isPending };
};

const useDeleteWidget = (
  setWidgets: Dispatch<SetStateAction<schema.DashboardWidget[]>>,
) => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const deleteWidgetMutation = api.dashboard.widget.delete.useMutation();
  const utils = api.useUtils();

  const deleteWidget = (widgetId: string) => {
    deleteWidgetMutation.mutate(widgetId);
    utils.dashboard.get.invalidate(dashboardId);
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.filter((widget) => widget.id !== widgetId);
      return newWidgets;
    });
  };
  return { deleteWidget, isDeletingWidget: deleteWidgetMutation.isPending };
};

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
  const { isEditMode, setIsEditMode } = useEditMode(setWidgets);
  const handleLayoutChange = useHandleLayoutChange(setWidgets);
  const { createWidget, isCreatingWidget } = useCreateWidget(setWidgets);
  const { updateWidget, isUpdatingWidget } = useUpdateWidget(setWidgets);
  const { deleteWidget, isDeletingWidget } = useDeleteWidget(setWidgets);
  const isUpdating = isCreatingWidget || isUpdatingWidget || isDeletingWidget;

  return (
    <DashboardContext.Provider
      value={{
        widgets,
        layout,
        isEditMode,
        setIsEditMode,
        setLayout: handleLayoutChange,
        createWidget,
        updateWidget,
        deleteWidget,
        isUpdating,
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
