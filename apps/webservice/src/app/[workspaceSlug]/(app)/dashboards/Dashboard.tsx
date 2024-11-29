"use client";

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import type { Workspace } from "@ctrlplane/db/schema";
import type { Layout } from "react-grid-layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { produce } from "immer";
import { clamp } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { cn } from "@ctrlplane/ui";

import type { WidgetLayout } from "./DashboardContext";
import type { Widget } from "./widgets";
import { api } from "~/trpc/react";
import { useDashboardContext } from "./DashboardContext";
import { DashboardGrid } from "./DashboardGrid";
import { widgets } from "./widgets";

export type DashboardContextObject = {
  editMode: boolean;
  setEditMode: (b: boolean) => void;
};

function layoutToWidget(w: WidgetLayout) {
  return {
    id: w.i,
    x: w.x,
    y: w.y,
    height: w.h,
    width: w.w,
    widget: w.widget,
    config: w.config ?? {},
  };
}

type OnAddWidget = (w: WidgetLayout) => void;

type DashboardEvents = {
  onAddWidget?: OnAddWidget;
  onDeleteWidget?: (i: string) => void;
  onEditWidget?: (i: string, w: Partial<WidgetLayout>) => void;
};

const RenderWidget: React.FC<{
  workspace: Workspace;
  id: string;
  spec: Widget;
  config: any;
  events?: DashboardEvents;
}> = ({ id, spec, config, events, workspace }) => {
  const { editMode } = useDashboardContext();
  const { deleteWidget, updateConfig } = useDashboardLayout(events);
  const { Component } = spec;
  return (
    <Component
      onDelete={() => deleteWidget(id)}
      isEditMode={editMode}
      config={config}
      updateConfig={(c) => updateConfig(id, c)}
      workspace={workspace}
    />
  );
};

const useDashboardLayout = (events?: DashboardEvents) => {
  const { layout, setLayout } = useDashboardContext();

  const updateWidget = useCallback(
    (i: string, item: Partial<WidgetLayout>) => {
      setLayout((oldLayout) =>
        produce(oldLayout, (l) => {
          const idx = l.findIndex((d) => d.i === i);
          if (idx === -1 || l[idx] == null) return;
          const data = { ...l[idx], ...item };
          l[idx] = data as any;
        }),
      );
      events?.onEditWidget?.(i, item);
    },
    [events, setLayout],
  );

  const updateConfig = useCallback(
    (i: string, config: any) => {
      setLayout((oldLayout) =>
        produce(oldLayout, (l) => {
          const idx = l.findIndex((d) => d.i === i);
          if (idx === -1 || l[idx] == null) return;

          l[idx]!.config = { ...l[idx]!.config, ...config };
          events?.onEditWidget?.(i, {
            config: { ...l[idx]!.config, ...config },
          });
        }),
      );
    },
    [events, setLayout],
  );

  const addWidget = useCallback(
    (item: WidgetLayout, skipEvent?: boolean) => {
      setLayout((oldLayout) =>
        produce(oldLayout, (l) => {
          const w = widgets[item.widget];
          if (w == null) return;

          const { minW, minH, maxH, maxW } = w.dimensions ?? {};
          const width = clamp(item.w, minW ?? 0, maxW ?? Infinity);
          const height = clamp(item.h, minH ?? 0, maxH ?? Infinity);
          const i = { minW, minH, maxH, maxW, ...item, w: width, h: height };
          l.push(i);

          if (!skipEvent) events?.onAddWidget?.(i);
        }),
      );
    },
    [events, setLayout],
  );

  const deleteWidget = useCallback(
    (id: string) => {
      setLayout((oldLayout) =>
        produce(oldLayout, (l) => {
          const idx = l.findIndex((d) => d.i === id);
          if (idx === -1) return;
          l.splice(idx, 1);
          events?.onDeleteWidget?.(id);
        }),
      );
    },
    [events, setLayout],
  );

  return {
    layout,
    setLayout,

    updateWidget,
    deleteWidget,
    addWidget,
    updateConfig,
  };
};

export const useDashboardGrid = (events?: DashboardEvents) => {
  const { editMode, droppingItem } = useDashboardContext();
  const { layout, updateWidget, addWidget } = useDashboardLayout(events);

  return {
    layout: [],

    droppingItem: useMemo(
      () => ({ w: 1, h: 1, ...(droppingItem ?? {}), i: "drop" }),
      [droppingItem],
    ),

    isDraggable: editMode,
    isResizable: editMode,
    isDroppable: editMode,

    layouts: { lg: layout },

    onDrop: useCallback(
      (oldLayout: Layout[], item: Layout) => {
        if (droppingItem == null) return;
        for (const l of oldLayout) {
          if (l.i === "drop") {
            const i = uuidv4();
            const wl: WidgetLayout = { ...droppingItem, ...item, i };
            addWidget(wl);
            continue;
          }

          updateWidget(l.i, { x: l.x, y: l.y });
        }
      },
      [droppingItem, updateWidget, addWidget],
    ),

    onLayoutChange: useCallback(
      (oldLayout: Layout[]) => {
        for (const l of oldLayout) {
          const w = layout.find((s) => s.i === l.i);
          if (w == null) return;
          const hasChanged =
            l.x !== w.x || l.y !== w.y || l.w !== w.w || l.h !== w.h;
          if (hasChanged) {
            const w = { x: l.x, y: l.y, w: l.w, h: l.h };
            updateWidget(l.i, w);
          }
        }
      },
      [layout, updateWidget],
    ),
  };
};

export const Dashboard: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const { dashboardId, setEditMode, editMode, layout } = useDashboardContext();

  const create = api.dashboard.widget.create.useMutation();
  const del = api.dashboard.widget.delete.useMutation();
  const update = api.dashboard.widget.update.useMutation();
  const onAddWidget = useCallback<OnAddWidget>(
    (lw) => {
      const w = layoutToWidget(lw);
      create.mutate({ dashboardId, ...w });
    },
    [create, dashboardId],
  );

  const events = useMemo<DashboardEvents>(
    () => ({
      onAddWidget,
      onDeleteWidget: (id) => {
        del.mutate(id);
      },
      onEditWidget: (id, lw) => {
        update.mutate({
          id,
          data: {
            x: lw.x,
            y: lw.y,
            width: lw.w,
            height: lw.h,
            config: lw.config,
          },
        });
      },
    }),
    [onAddWidget, del, update],
  );

  const { addWidget } = useDashboardLayout(events);
  const dashboard = api.dashboard.get.useQuery(dashboardId, {
    enabled: dashboardId !== "",
  });

  const [hasInitWidgets, setHasInitWidgets] = useState(false);
  useEffect(() => {
    if (hasInitWidgets) return;
    if (dashboard.data == null) return;

    const ws = dashboard.data.widgets;
    if (ws.length === 0) {
      setEditMode(true);
      return;
    }

    setHasInitWidgets(true);
    for (const w of ws) {
      addWidget(
        {
          widget: w.widget,
          i: w.id,
          h: w.height,
          w: w.width,
          x: w.x,
          y: w.y,
          config: w.config,
        },
        true,
      );
    }
  }, [dashboard.data, setEditMode, addWidget, hasInitWidgets]);

  const grid = useDashboardGrid(events);

  return (
    <DashboardGrid
      {...grid}
      className={cn(
        "m-10 mb-16 rounded-md border border-dotted",
        editMode ? "border-neutral-800" : "border-transparent",
      )}
    >
      {layout.map((item) => {
        const { i, widget } = item;
        const spec = widgets[widget];
        if (spec == null) return <div key={i}>Invalid widget</div>;
        return (
          <div key={i} className="relative h-full w-full">
            <RenderWidget
              id={i}
              workspace={workspace}
              spec={spec}
              config={item.config ?? {}}
              events={events}
            />
          </div>
        );
      })}
    </DashboardGrid>
  );
};
