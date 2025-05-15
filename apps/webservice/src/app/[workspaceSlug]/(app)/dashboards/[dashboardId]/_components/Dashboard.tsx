"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { useParams } from "next/navigation";
import { Responsive, WidthProvider } from "react-grid-layout";

import type { NewWidget } from "./DashboardContext";
import type { WidgetKind } from "./widgets/WidgetKinds";
import { NEW_WIDGET_ID, useDashboard } from "./DashboardContext";
import { WidgetComponents } from "./widgets/WidgetKinds";

const ReactGridLayout = WidthProvider(Responsive);

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

const CreateWidgetPlaceholder: React.FC<{
  widgetBeingCreated: NewWidget;
}> = ({ widgetBeingCreated }) => {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const { Component } = WidgetComponents[widgetBeingCreated.widgetKind];

  const widget = {
    id: NEW_WIDGET_ID,
    widget: widgetBeingCreated.widgetKind,
    config: {},
    name: "New Widget",
    dashboardId,
    ...widgetBeingCreated,
  };

  return <Component widget={widget} />;
};

export const Dashboard: React.FC = () => {
  const {
    dashboard,
    layout,
    setLayout,
    widgetBeingCreated,
    addWidgetCreationPlaceholder,
  } = useDashboard();

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
        addWidgetCreationPlaceholder({ ...item, widgetKind: wk });
      }}
    >
      {widgetBeingCreated != null && (
        <div key={NEW_WIDGET_ID} data-grid={{ ...widgetBeingCreated }}>
          <CreateWidgetPlaceholder widgetBeingCreated={widgetBeingCreated} />
        </div>
      )}
      {dashboard.widgets.map((widget) => {
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
