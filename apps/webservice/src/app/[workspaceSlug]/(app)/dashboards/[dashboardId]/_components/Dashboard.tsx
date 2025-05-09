"use client";

import type * as schema from "@ctrlplane/db/schema";
import { Responsive, WidthProvider } from "react-grid-layout";

import { useDashboard } from "./DashboardContext";
import { DashboardWidget } from "./DashboardWidget";

const ReactGridLayout = WidthProvider(Responsive);

type Dashboard = schema.Dashboard & {
  widgets: schema.DashboardWidget[];
};

export const Dashboard: React.FC = () => {
  const { dashboard, layout, setLayout } = useDashboard();

  return (
    <ReactGridLayout
      layouts={layout}
      breakpoints={{ lg: 0 }}
      rowHeight={30}
      cols={{ lg: 12 }}
      margin={[16, 16]}
      onLayoutChange={setLayout}
      draggableHandle=".widget-drag-handle"
    >
      {dashboard.widgets.map((widget) => {
        const layoutItem = layout.lg?.find((item) => item.i === widget.id);
        if (layoutItem == null) return null;

        return (
          <div
            key={widget.id}
            data-grid={{ ...layoutItem }}
            // className="rounded-sm border bg-background"
          >
            <DashboardWidget
              {...widget}
              WidgetActions={<div>Actions</div>}
              WidgetContent={<div>Content</div>}
            />
          </div>
        );
      })}
      {/* {dashboard.widgets.map((widget) => (
        <div
          key={widget.id}
          data-grid={{ ...widget }}
          className="rounded-sm border bg-background p-2"
        >
          {widget.name}
        </div>
      ))} */}
    </ReactGridLayout>
  );
};
