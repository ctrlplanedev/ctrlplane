import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";

export type DashboardWidget = {
  displayName: string;
  Icon: React.ReactNode;
  Component: React.FC<{ widget: SCHEMA.DashboardWidget }>;
};

export const DashboardWidgetCard: React.FC<{
  name: string;
  WidgetActions: React.ReactNode;
  children: React.ReactNode;
}> = ({ name, WidgetActions, children }) => {
  return (
    <div className="flex h-full w-full flex-col rounded-sm border bg-background">
      <div className="widget-drag-handle flex cursor-move items-center gap-2 border-b p-2">
        <div className="min-w-0 flex-grow truncate">{name}</div>
        {WidgetActions}
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
};
