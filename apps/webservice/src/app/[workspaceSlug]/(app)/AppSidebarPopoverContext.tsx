"use client";

import { createContext, useContext, useState } from "react";

import {
  Sidebar,
  SidebarMenuItem,
  SidebarMenuSubItem,
} from "@ctrlplane/ui/sidebar";

type AppSidebarPopoverContextType = {
  activeSidebarItem: string | null;
  setActiveSidebarItem: (item: string | null) => void;
};

const AppSidebarPopoverContext = createContext<AppSidebarPopoverContextType>({
  activeSidebarItem: null,
  setActiveSidebarItem: () => {},
});

export const useSidebarPopover = () => useContext(AppSidebarPopoverContext);

export const AppSidebarPopoverProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [activeSidebarItem, setActiveSidebarItem] = useState<string | null>(
    null,
  );
  return (
    <AppSidebarPopoverContext.Provider
      value={{ activeSidebarItem, setActiveSidebarItem }}
    >
      {children}
    </AppSidebarPopoverContext.Provider>
  );
};

export const SidebarWithPopover: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <Sidebar onMouseLeave={() => setActiveSidebarItem(null)} name="sidebar">
      {children}
    </Sidebar>
  );
};

export const SidebarMenuItemWithPopover: React.FC<{
  children: React.ReactNode;
  popoverId?: string;
}> = ({ children, popoverId }) => {
  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <SidebarMenuItem
      onMouseEnter={(e) => {
        if (popoverId != null) {
          setActiveSidebarItem(popoverId);
          e.stopPropagation();
        }
      }}
    >
      {children}
    </SidebarMenuItem>
  );
};

export const SidebarMenuSubItemWithPopover: React.FC<{
  children: React.ReactNode;
  popoverId?: string;
}> = ({ children, popoverId }) => {
  const { setActiveSidebarItem } = useSidebarPopover();
  return (
    <SidebarMenuSubItem
      onMouseEnter={(e) => {
        if (popoverId != null) {
          setActiveSidebarItem(popoverId);
          e.stopPropagation();
        }
      }}
    >
      {children}
    </SidebarMenuSubItem>
  );
};
