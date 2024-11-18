"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Layout } from "react-grid-layout";
import { createContext, useContext, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrevious } from "react-use";

export type WidgetDroppingItem = { w: number; h: number; widget: string };
export type WidgetLayout<T extends object = any> = Layout & {
  widget: string;
  config?: T;
};

export type DashboardContextObject = {
  dashboardId: string;
  editMode: boolean;
  setEditMode: (b: boolean) => void;
  droppingItem?: WidgetDroppingItem;
  setDroppingItem: (d?: WidgetDroppingItem) => void;
  layout: WidgetLayout[];
  setLayout: Dispatch<SetStateAction<WidgetLayout[]>>;
};

const Dashboard = createContext<DashboardContextObject>({} as any);
export const DashboardProvider: React.FC<{
  dashboardId: string;
  children: React.ReactNode;
}> = ({ dashboardId, children }) => {
  const query = useSearchParams();

  const [editMode, setEditMode] = useState(query.get("edit") != null);
  const [droppingItem, setDroppingItem] = useState<WidgetDroppingItem>();
  const [layout, setLayout] = useState<WidgetLayout[]>([]);

  return (
    <Dashboard.Provider
      value={{
        dashboardId,

        editMode,
        setEditMode,

        droppingItem,
        setDroppingItem,

        layout,
        setLayout,
      }}
    >
      {children}
    </Dashboard.Provider>
  );
};

export const useDashboardContext = () => {
  const ctx = useContext(Dashboard);
  const { editMode } = ctx;
  const previousId = usePrevious(ctx.dashboardId);
  const wasEditMode = usePrevious(editMode);
  return { previousId, wasEditMode, ...ctx };
};
