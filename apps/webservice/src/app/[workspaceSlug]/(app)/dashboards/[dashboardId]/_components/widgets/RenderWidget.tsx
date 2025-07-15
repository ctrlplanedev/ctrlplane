import type * as schema from "@ctrlplane/db/schema";
import type React from "react";
import { useParams } from "next/navigation";

import type { WidgetKind } from "./WidgetKinds";
import { useEditingWidget } from "../../_hooks/useEditingWidget";
import { useExpandedWidget } from "../../_hooks/useExpandedWidget";
import { NEW_WIDGET_ID, useDashboard } from "../../DashboardContext";
import { WidgetComponents } from "./WidgetKinds";

export const RenderWidget: React.FC<{
  widget: schema.DashboardWidget;
}> = ({ widget }) => {
  const dashboard = useDashboard();
  const { dashboardId } = useParams<{ dashboardId: string }>();

  const { Component } = WidgetComponents[widget.widget as WidgetKind];

  const { setExpandedWidget, clearExpandedWidget, expandedWidgetId } =
    useExpandedWidget();
  const { setEditingWidget, clearEditingWidget, editingWidgetId } =
    useEditingWidget();

  const setIsExpanded = (isExpanded: boolean) => {
    if (isExpanded) {
      setExpandedWidget(widget.id);
      return;
    }
    clearExpandedWidget();
  };

  const setIsEditing = (isEditing: boolean) => {
    if (isEditing) {
      setEditingWidget(widget.id);
      return;
    }
    clearEditingWidget();
  };

  const upsertConfig = async (config: Record<string, any>) => {
    if (widget.id !== NEW_WIDGET_ID) {
      dashboard.updateWidget(widget.id, { config });
      return;
    }

    await dashboard.createWidget({
      dashboardId,
      widget: widget.widget,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      name: widget.name,
      config,
    });
  };

  const isEditMode = dashboard.isEditMode;

  return (
    <Component
      config={widget.config}
      isEditMode={isEditMode}
      setIsExpanded={setIsExpanded}
      setIsEditing={setIsEditing}
      updateConfig={upsertConfig}
      isExpanded={expandedWidgetId === widget.id}
      isEditing={editingWidgetId === widget.id}
      onDelete={() => dashboard.deleteWidget(widget.id)}
      isUpdating={dashboard.isUpdating}
    />
  );
};
