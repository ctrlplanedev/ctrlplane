"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Responsive, WidthProvider } from "react-grid-layout";

import type { WidgetKind } from "./widgets/WidgetKinds";
import { NEW_WIDGET_ID, useDashboard } from "../DashboardContext";
import { RenderWidget } from "./widgets/RenderWidget";

const ReactGridLayout = WidthProvider(Responsive);

export const Dashboard: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const { widgets, layout, setLayout, isEditMode, createWidget } =
    useDashboard();

  return (
    <ReactGridLayout
      layouts={layout}
      isResizable={isEditMode}
      breakpoints={{ lg: 0 }}
      rowHeight={5}
      cols={{ lg: 32 }}
      margin={[16, 16]}
      onLayoutChange={(layout) => setLayout(layout)}
      draggableHandle=".widget-drag-handle"
      isDroppable
      droppingItem={{ i: NEW_WIDGET_ID, h: 6, w: 3 }}
      onDrop={(_, item, e: DragEvent) => {
        e.preventDefault();
        const widgetKind = e.dataTransfer?.getData("widget-kind");
        if (widgetKind == null) return;
        const wk = widgetKind as WidgetKind;

        createWidget({
          dashboardId,
          widget: wk,
          config: {},
          name: "New Widget",
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        });
      }}
    >
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
