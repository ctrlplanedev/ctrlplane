"use client";

import type * as schema from "@ctrlplane/db/schema";
import { Responsive, WidthProvider } from "react-grid-layout";

import type { WidgetKind } from "./widgets/WidgetKinds";
import { useDashboard } from "./DashboardContext";
import { WidgetComponents } from "./widgets/WidgetKinds";

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

        const WidgetComponent = WidgetComponents[widget.widget as WidgetKind];
        return (
          <div key={widget.id} data-grid={{ ...layoutItem }}>
            <WidgetComponent widget={widget} />
          </div>
        );
      })}
    </ReactGridLayout>
  );
};
