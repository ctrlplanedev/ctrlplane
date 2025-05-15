"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { Layout, Layouts } from "react-grid-layout";
import { createContext, useContext, useState } from "react";

import type { WidgetKind } from "./widgets/WidgetKinds";
import { api } from "~/trpc/react";
import { useExpandedWidget } from "../_hooks/useExpandedWidget";

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

export type NewWidget = Layout & { widgetKind: WidgetKind };

type DashboardContextType = {
  dashboard: Dashboard;
  layout: Layouts;
  setLayout: (currentLayout: Layout[], allLayouts: Layouts) => void;
  widgetBeingCreated: NewWidget | null;
  addWidgetCreationPlaceholder: (item: NewWidget) => void;
  createWidget: (widget: schema.DashboardWidgetInsert) => Promise<void>;
  deleteWidget: (widgetId: string) => Promise<void>;
};

export const NEW_WIDGET_ID = "new_widget";

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

  const [widgetBeingCreated, setWidgetBeingCreated] =
    useState<NewWidget | null>(null);

  const { setExpandedWidget, clearExpandedWidget } = useExpandedWidget();

  const addWidgetCreationPlaceholder = (item: NewWidget) => {
    setLayout((prevLayout) => {
      return {
        ...prevLayout,
        lg: [...(prevLayout.lg ?? []), item],
      };
    });
    setWidgetBeingCreated(item);
    setExpandedWidget(item.i, true);
  };

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

        if (!isResized || layoutItem.i === NEW_WIDGET_ID) continue;

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

      const newWidget = prevLayout.lg?.find((item) => item.i === NEW_WIDGET_ID);
      if (newWidget)
        return {
          ...allLayouts,
          lg: [
            ...(allLayouts.lg?.filter((item) => item.i !== NEW_WIDGET_ID) ??
              []),
            newWidget,
          ],
        };

      return allLayouts;
    });

  const createWidgetMutation = api.dashboard.widget.create.useMutation();
  const utils = api.useUtils();
  const createWidget = async (widget: schema.DashboardWidgetInsert) => {
    const newWidget = await createWidgetMutation.mutateAsync(widget);
    setWidgetBeingCreated(null);
    utils.dashboard.get.invalidate();
    setLayout((prevLayout) => {
      const prevLayoutWithoutNewWidget = prevLayout.lg?.filter(
        (item) => item.i !== NEW_WIDGET_ID,
      );
      const lg = [
        ...(prevLayoutWithoutNewWidget ?? []),
        { i: newWidget.id, ...widget },
      ];
      return { ...prevLayout, lg };
    });
    clearExpandedWidget();
  };

  const deleteWidgetMutation = api.dashboard.widget.delete.useMutation();
  const deleteWidget = async (widgetId: string) => {
    if (widgetId !== NEW_WIDGET_ID)
      await deleteWidgetMutation.mutateAsync(widgetId);

    setLayout((prevLayout) => {
      const layoutWithoutWidget = prevLayout.lg?.filter(
        (item) => item.i !== widgetId,
      );
      const lg = [...(layoutWithoutWidget ?? [])];
      return { ...prevLayout, lg };
    });
    clearExpandedWidget();
    utils.dashboard.get.invalidate();
  };

  return (
    <DashboardContext.Provider
      value={{
        dashboard,
        layout,
        setLayout: handleLayoutChange,
        widgetBeingCreated,
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
