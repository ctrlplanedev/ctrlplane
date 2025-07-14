"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Responsive, WidthProvider } from "react-grid-layout";

import type { WidgetKind } from "./widgets/WidgetKinds";
import { useEditingWidget } from "../_hooks/useEditingWidget";
import { NEW_WIDGET_ID, useDashboard } from "../DashboardContext";
import { RenderWidget } from "./widgets/RenderWidget";

const ReactGridLayout = WidthProvider(Responsive);

export const Dashboard: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const { widgets, layout, setLayout, isEditMode } = useDashboard();
  const { setEditingWidget } = useEditingWidget();

  const widgetBeingCreated = widgets.find(
    (widget) => widget.id === NEW_WIDGET_ID,
  );

  return (
    <ReactGridLayout
      layouts={layout}
      isResizable={isEditMode}
      breakpoints={{ lg: 0 }}
      rowHeight={30}
      cols={{ lg: 12 }}
      margin={[16, 16]}
      onLayoutChange={(layout) => setLayout(layout)}
      draggableHandle=".widget-drag-handle"
      isDroppable
      droppingItem={{ i: NEW_WIDGET_ID, h: 6, w: 3 }}
      onDrop={(layout, item, e: DragEvent) => {
        e.preventDefault();
        const widgetKind = e.dataTransfer?.getData("widget-kind");
        if (widgetKind == null) return;
        const wk = widgetKind as WidgetKind;

        const layoutWithoutPlaceholder = layout.filter(
          (item) => item.i !== NEW_WIDGET_ID,
        );

        const placeholderItem = {
          ...item,
          id: NEW_WIDGET_ID,
          dashboardId,
          name: "New Widget",
          widget: wk,
          config: {},
        };
        setEditingWidget(NEW_WIDGET_ID);
        setLayout(layoutWithoutPlaceholder, placeholderItem);
      }}
    >
      {widgetBeingCreated != null && (
        <div key={NEW_WIDGET_ID} data-grid={{ ...widgetBeingCreated }}>
          <RenderWidget widget={widgetBeingCreated} />
        </div>
      )}
      {widgets.map((widget) => {
        const layoutItem = layout.lg?.find((item) => item.i === widget.id);
        if (layoutItem == null) return null;
        return (
          <div key={widget.id} data-grid={{ ...layoutItem }}>
            <RenderWidget widget={widget} />
          </div>
        );
      })}
    </ReactGridLayout>
  );
};
