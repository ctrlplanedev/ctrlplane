"use client";

import { createContext, useContext } from "react";

type SidebarContextType = {
  activeSidebarItem: string | null;
  setActiveSidebarItem: (item: string | null) => void;
};

export const SidebarContext = createContext<SidebarContextType>({
  activeSidebarItem: null,
  setActiveSidebarItem: () => {},
});

export const useSidebar = () => useContext(SidebarContext);
