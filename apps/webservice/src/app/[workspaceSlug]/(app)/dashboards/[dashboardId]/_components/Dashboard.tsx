"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";
import { Responsive, WidthProvider } from "react-grid-layout";

import type { WidgetKind } from "./widgets/WidgetKinds";
import { NEW_WIDGET_ID, useDashboard } from "./DashboardContext";
import { WidgetComponents } from "./widgets/WidgetKinds";

const ReactGridLayout = WidthProvider(Responsive);

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

const CreateWidgetPlaceholder: React.FC<{
  widgetBeingCreated: schema.DashboardWidget;
}> = ({ widgetBeingCreated }) => {
  const { Component } =
    WidgetComponents[widgetBeingCreated.widget as WidgetKind];
  return <Component widget={widgetBeingCreated} />;
};

export const Dashboard: React.FC = () => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const { widgets, layout, setLayout, addWidgetCreationPlaceholder } =
    useDashboard();
  const widgetBeingCreated = widgets.find(
    (widget) => widget.id === NEW_WIDGET_ID,
  );

  return (
    <ReactGridLayout
      layouts={layout}
      breakpoints={{ lg: 0 }}
      rowHeight={30}
      cols={{ lg: 12 }}
      margin={[16, 16]}
      onLayoutChange={setLayout}
      draggableHandle=".widget-drag-handle"
      isDroppable
      droppingItem={{ i: NEW_WIDGET_ID, h: 6, w: 3 }}
      onDrop={(_, item, e: DragEvent) => {
        const widgetKind = e.dataTransfer?.getData("widget-kind");
        if (widgetKind == null) return;
        const wk = widgetKind as WidgetKind;
        addWidgetCreationPlaceholder({
          ...item,
          id: item.i,
          widget: wk,
          dashboardId,
          name: "New Widget",
          config: {},
        });
      }}
    >
      {widgetBeingCreated != null && (
        <div key={NEW_WIDGET_ID} data-grid={{ ...widgetBeingCreated }}>
          <CreateWidgetPlaceholder widgetBeingCreated={widgetBeingCreated} />
        </div>
      )}
      {widgets.map((widget) => {
        const layoutItem = layout.lg?.find((item) => item.i === widget.id);
        if (layoutItem == null) return null;
        const { Component } = WidgetComponents[widget.widget as WidgetKind];
        return (
          <div key={widget.id} data-grid={{ ...layoutItem }}>
            <Component widget={widget} />
          </div>
        );
      })}
    </ReactGridLayout>
  );
};
